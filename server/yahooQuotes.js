const contracts = [
  ['NQ', 'NQ=F'], ['ES', 'ES=F'], ['YM', 'YM=F'], ['RTY', 'RTY=F'],
  ['BTC', 'BTC-USD'], ['ETH', 'ETH-USD'], ['FTSE', '^FTSE'], ['NIKKEI', '^N225'],
];

// Coalesce requests per warm instance. A failed symbol never erases its peers.
export function createQuoteService(fetchImpl = (...args) => fetch(...args), now = Date.now) {
  const last = new Map();
  let pending;
  let cached;
  let expires = 0;
  async function quote([symbol, yahooSymbol]) {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
    url.searchParams.set('interval', '1m');
    url.searchParams.set('range', '1d');
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error('Quote unavailable');
    const payload = await response.json();
    const meta = payload.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
    if (payload.chart?.error || !Number.isFinite(price) || price <= 0 || !Number.isFinite(previousClose) || previousClose <= 0) throw new Error('Invalid quote');
    const result = {
      symbol, price, change: price - previousClose,
      changePercent: (price - previousClose) / previousClose * 100,
      marketTime: Number.isFinite(meta.regularMarketTime) ? meta.regularMarketTime * 1000 : null,
      fetchedAt: now(), provider: 'Yahoo Finance', status: 'delayed',
    };
    last.set(symbol, result);
    return result;
  }
  return async function fetchQuotes() {
    if (cached && now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      const results = await Promise.allSettled(contracts.map(quote));
      const quotes = results.map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        const symbol = contracts[index][0];
        const previous = last.get(symbol);
        return previous && now() - previous.fetchedAt < 86400000
          ? { ...previous, status: 'stale' }
          : { symbol, price: null, status: 'unavailable' };
      });
      // Overall health reflects the symbols: "delayed" if any quote is fresh,
      // "stale" if only last-known prices remain, otherwise "unavailable".
      const status = quotes.some(item => item.status === 'delayed') ? 'delayed'
        : quotes.some(item => item.status === 'stale') ? 'stale' : 'unavailable';
      cached = { quotes, fetchedAt: now(), provider: 'Yahoo Finance', status };
      // Retry an unhealthy feed sooner than a healthy one.
      expires = now() + (status === 'delayed' ? 15000 : 5000);
      return cached;
    })();
    try { return await pending; } finally { pending = null; }
  };
}

export const fetchYahooQuotes = createQuoteService();
