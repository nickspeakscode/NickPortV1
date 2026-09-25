// An anchored project reveal; the supplied character provides the only looping motion.
export function initializeSumlinoCharacter() {
  const trigger = document.querySelector('.redacted-mark');
  if (!trigger) return;

  const preview = document.createElement('div');
  preview.id = 'sumlino-teaser';
  preview.className = 'sumlino-preview';
  preview.hidden = true;
  preview.innerHTML = `
    <a class="sumlino-project" href="https://x.com/sumlinoapp" target="_blank"
       rel="noopener noreferrer" aria-label="View Sumlino on X">
      <span class="sumlino-art" aria-hidden="true">
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcset="/sumlino-cobalt-still.png" />
          <img class="sumlino-character" src="/sumlino-cobalt-still.png" width="512" height="512" alt="" draggable="false" />
        </picture>
      </span>
      <span class="sumlino-details" aria-hidden="true">
        <span class="sumlino-byline">A project by Nick</span>
        <span class="sumlino-title">Sumlino</span>
        <span class="sumlino-description">Month-end reconciliation<br>for accountants.</span>
      </span>
      <span class="sumlino-footer" aria-hidden="true"><span>Follow on X</span><span class="sumlino-arrow">↗</span></span>
    </a>
    <button class="sumlino-dismiss" type="button" aria-label="Close Sumlino preview">×</button>`;
  // Keep fixed positioning independent of the About section's reveal transform.
  document.body.append(preview);
  const link = preview.querySelector('a');
  const image = preview.querySelector('img');
  const close = preview.querySelector('button');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let open = false;
  let closeTimer;
  let lastPointer = '';

  function position() {
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft || 0) + 16;
    const topEdge = Math.max((viewport?.offsetTop || 0) + 12,
      (document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 10);
    const rightEdge = leftEdge + (viewport?.width || innerWidth) - 32;
    const bottomEdge = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 12;
    preview.style.width = Math.min(368, rightEdge - leftEdge) + 'px';
    preview.style.maxHeight = Math.max(80, bottomEdge - topEdge) + 'px';
    const { width, height } = preview.getBoundingClientRect();
    const above = rect.top - height - 12 >= topEdge;
    const x = Math.max(leftEdge, Math.min(rect.left + rect.width / 2 - width / 2, rightEdge - width));
    const y = above ? rect.top - height - 12 : Math.max(topEdge, Math.min(rect.bottom + 12, bottomEdge - height));
    preview.style.left = x + 'px';
    preview.style.top = y + 'px';
    preview.style.setProperty('--reveal-origin', above ? 'bottom' : 'top');
  }

  function syncImage() {
    image.src = open && !reducedMotion.matches ? '/sumlino-cobalt.gif' : '/sumlino-cobalt-still.png';
  }

  function hide(restoreFocus = false) {
    clearTimeout(closeTimer);
    if (!open) return;
    open = false;
    if (restoreFocus) trigger.focus({ preventScroll: true });
    preview.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-revealed');
    syncImage();
  }

  function show(keyboard = false) {
    clearTimeout(closeTimer);
    if (!open) {
      open = true;
      preview.hidden = false;
      position();
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('is-revealed');
      syncImage();
    }
    if (keyboard) link.focus({ preventScroll: true });
  }

  function scheduleHide() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!preview.contains(document.activeElement) && document.activeElement !== trigger) hide();
    }, 240);
  }

  trigger.addEventListener('pointerdown', event => { lastPointer = event.pointerType; });
  trigger.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') show();
  });
  trigger.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'touch') scheduleHide();
  });
  preview.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  preview.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'touch') scheduleHide();
  });
  trigger.addEventListener('click', event => {
    if (event.detail === 0) show(true);
    else if (lastPointer === 'touch' && open) hide();
    else show();
  });
  trigger.addEventListener('keydown', event => {
    if (open && event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      link.focus({ preventScroll: true });
    }
  });
  link.addEventListener('keydown', event => {
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault();
      trigger.focus({ preventScroll: true });
    }
  });
  const handleFocusOut = event => {
    if (event.relatedTarget !== trigger && !preview.contains(event.relatedTarget)) hide();
  };
  trigger.addEventListener('focusout', handleFocusOut);
  preview.addEventListener('focusout', handleFocusOut);
  close.addEventListener('click', () => hide(true));
  link.addEventListener('click', () => hide());
  document.addEventListener('pointerdown', event => {
    if (!preview.contains(event.target) && !trigger.contains(event.target)) hide();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide(preview.contains(document.activeElement));
  });
  // Do not leave a project preview covering unrelated content after scrolling away.
  window.addEventListener('scroll', () => hide(), { passive: true });
  window.addEventListener('resize', () => { if (open) position(); });
  window.visualViewport?.addEventListener('resize', () => { if (open) position(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  window.addEventListener('pagehide', () => hide());
  reducedMotion.addEventListener('change', syncImage);
}