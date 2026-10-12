const SYMBOLS = ['NQ', 'ES', 'YM', 'RTY', 'BTC', 'ETH', 'FTSE', 'NIKKEI'];
const CACHE_KEY = 'nt-market-v2';
const valid = quote => quote && Number.isFinite(quote.price) && quote.price > 0;
const priceFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function initializeMarketTicker(track, endpoint = '/api/market-data') {
  if (!track) return () => {};
  const prices = new Map();
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    for (const quote of saved) if (SYMBOLS.includes(quote.symbol) && valid(quote) && Date.now() - quote.fetchedAt < 86400000) prices.set(quote.symbol, { ...quote, status: 'stale' });
  } catch { /* Storage can be blocked on private browsers. */ }
  const group = document.createElement('div');
  group.className = 'ticker-group';
  for (const symbol of SYMBOLS) {
    const item = document.createElement('span');
    item.className = 'ticker-item';
    item.dataset.symbol = symbol;
    item.innerHTML = `<strong>${symbol}</strong><span class="ticker-price">—</span><em></em><small>loading</small>`;
    group.append(item);
  }
  const duplicate = group.cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true');
  track.replaceChildren(group, duplicate);
  const items = [...track.querySelectorAll('.ticker-item')];
  // Moving content needs a pause control (WCAG 2.2.2): clicking or tapping the
  // strip toggles it, and a button appears for keyboard users on focus.
  const strip = track.parentElement;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ticker-toggle';
  strip.prepend(toggle);
  function setUserPaused(paused) {
    strip.toggleAttribute('data-user-paused', paused);
    toggle.textContent = 'Pause ticker';
    toggle.setAttribute('aria-pressed', String(paused));
    strip.title = paused ? 'Click to resume' : 'Click to pause';
  }
  setUserPaused(false);
  const onStripClick = () => setUserPaused(!strip.hasAttribute('data-user-paused'));
  strip.addEventListener('click', onStripClick);
  const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncFocusable = () => { if (stillMotion.matches) strip.tabIndex = 0; else strip.removeAttribute('tabindex'); };
  syncFocusable();
  stillMotion.addEventListener?.('change', syncFocusable);
  let disposed = false;
  let busy = false;
  let controller;
  let socket;
  let reconnect;
  let backoff = 1000;
  let lastMessage = 0;
  let paintTimer;
  let attempted = false;

  function paint() {
    paintTimer = null;
    for (const item of items) {
      const quote = prices.get(item.dataset.symbol);
      const available = valid(quote);
      const stale = available && (quote.status === 'stale' || Date.now() - quote.fetchedAt > 90000);
      item.className = `ticker-item ${stale ? 'is-stale' : ''} ${!available ? 'is-unavailable' : ''} ${available && quote.changePercent < 0 ? 'down' : 'up'}`;
      item.querySelector('.ticker-price').textContent = available ? priceFormat.format(quote.price) : '—';
      item.querySelector('em').textContent = stale ? 'stale' : !available ? (attempted ? 'offline' : 'loading') : Number.isFinite(quote.changePercent) ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : '—';
      item.querySelector('small').textContent = available ? (stale ? 'stale' : quote.status) : (attempted ? 'offline' : 'loading');
      item.title = available ? `${quote.symbol} · ${quote.provider} · ${stale ? 'last known price' : quote.status} · ${quote.status === 'live' ? '24-hour change' : 'change from previous close'}${quote.marketTime ? ' · Quote time ' + new Date(quote.marketTime).toLocaleString() : ''}` : `${item.dataset.symbol}: price temporarily unavailable`;
    }
  }
  function schedulePaint() {
    if (!paintTimer) paintTimer = setTimeout(paint, 250);
  }
  paint(); // Never wait for the network before showing every symbol.

  async function refresh() {
    if (busy || disposed || document.hidden) return;
    busy = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Feed unavailable');
      const payload = await response.json();
      if (!Array.isArray(payload.quotes)) throw new Error('Invalid feed');
      if (disposed) return;
      for (const symbol of SYMBOLS) {
        const current = prices.get(symbol);
        if (current?.status === 'live' && Date.now() - current.fetchedAt < 90000) continue;
        const next = payload.quotes.find(quote => quote.symbol === symbol);
        if (valid(next)) prices.set(symbol, { ...next, status: next.status === 'stale' ? 'stale' : 'delayed', fetchedAt: Number.isFinite(next.fetchedAt) ? next.fetchedAt : Date.now(), provider: 'Yahoo Finance' });
        else if (current) prices.set(symbol, { ...current, status: 'stale' });
      }
      try { localStorage.setItem(CACHE_KEY, JSON.stringify([...prices.values()])); } catch { /* Optional cache. */ }
    } catch {
      for (const [symbol, quote] of prices) if (quote.status !== 'live') prices.set(symbol, { ...quote, status: 'stale' });
    } finally {
      clearTimeout(timeout);
      attempted = true;
      busy = false;
      if (!disposed) paint();
    }
  }

  function disconnect() {
    clearTimeout(reconnect);
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.onopen = null;
      socket.onerror = null;
      socket.close();
      socket = null;
    }
    for (const symbol of ['BTC', 'ETH']) {
      const quote = prices.get(symbol);
      if (quote?.status === 'live') prices.set(symbol, { ...quote, status: 'stale' });
    }
  }
  function connect() {
    if (disposed || document.hidden || socket || !('WebSocket' in window)) return;
    clearTimeout(reconnect);
    try { socket = new WebSocket('wss://ws.kraken.com/v2'); }
    catch { retry(); return; }
    lastMessage = Date.now();
    socket.onopen = () => socket?.send(JSON.stringify({ method: 'subscribe', params: { channel: 'ticker', symbol: ['BTC/USD', 'ETH/USD'], snapshot: true } }));
    socket.onmessage = event => {
      lastMessage = Date.now();
      try {
        const message = JSON.parse(event.data);
        if (message.channel !== 'ticker' || !Array.isArray(message.data)) return;
        for (const tick of message.data) {
          const symbol = tick.symbol === 'BTC/USD' ? 'BTC' : tick.symbol === 'ETH/USD' ? 'ETH' : null;
          if (!symbol || !Number.isFinite(tick.last) || tick.last <= 0) continue;
          backoff = 1000;
          prices.set(symbol, { symbol, price: tick.last, changePercent: tick.change_pct, status: 'live', provider: 'Kraken USD spot', fetchedAt: Date.now(), marketTime: Date.parse(tick.timestamp) || null });
        }
        schedulePaint();
      } catch { /* Ignore malformed or non-ticker messages. */ }
    };
    socket.onerror = () => socket?.close();
    socket.onclose = retry;
  }
  function retry() {
    disconnect();
    paint();
    if (disposed || document.hidden) return;
    reconnect = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30000);
  }
  function resume() {
    if (disposed) return;
    track.parentElement.toggleAttribute('data-paused', document.hidden);
    if (document.hidden) { controller?.abort(); disconnect(); }
    else { refresh(); connect(); }
  }
  function pageHide() { controller?.abort(); disconnect(); }
  const interval = setInterval(() => {
    if (document.hidden) return;
    refresh();
    if (socket && Date.now() - lastMessage > 45000) retry();
    paint();
  }, 15000);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('pagehide', pageHide);
  resume();
  return () => {
    disposed = true;
    pageHide();
    clearInterval(interval);
    clearTimeout(paintTimer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('pageshow', resume);
    window.removeEventListener('pagehide', pageHide);
    strip.removeEventListener('click', onStripClick);
    stillMotion.removeEventListener?.('change', syncFocusable);
    toggle.remove();
  };
}
