// Enhance real detail-page links with a reversible cover-to-reader transition.
export function initializeLibraryShelf(root, { findResource, loadResource, renderDetail }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'library-reader';
  dialog.setAttribute('aria-labelledby', 'library-reader-title');
  dialog.innerHTML = `<div class="reader-toolbar">
    <button type="button" class="reader-close" autofocus>← Return to shelf</button>
    <a class="reader-permalink">Open full page <span aria-hidden="true">↗</span></a>
    </div><div class="reader-content"></div><p class="reader-notice" role="status" hidden></p>`;
  document.body.append(dialog);
  const content = dialog.querySelector('.reader-content');
  const notice = dialog.querySelector('.reader-notice');
  const closeButton = dialog.querySelector('.reader-close');
  const permalink = dialog.querySelector('.reader-permalink');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let origin;
  let version = 0;
  let effect;
  const pageEffects = new Set();
  let ghost;
  let closing = false;
  let savedOverflow;
  let savedPadding;
  let backdropDown = false;
  let disposed = false;

  async function finishWithin(animation, duration) {
    let timer;
    try {
      // Some browsers defer a closing dialog's animation timeline. Never leave
      // an invisible modal blocking the page while waiting for its finish event.
      await Promise.race([
        animation.finished.catch(() => {}),
        new Promise(resolve => {
          timer = setTimeout(() => {
            try { animation.finish(); } catch { /* It may already be cancelled. */ }
            resolve();
          }, duration + 120);
        }),
      ]);
    } finally { clearTimeout(timer); }
  }

  async function animatePage(element, frames, timing) {
    if (!element || motion.matches) return;
    const animation = element.animate(frames, { ...timing, fill: 'both', easing: 'cubic-bezier(.22,.7,.2,1)' });
    pageEffects.add(animation);
    await finishWithin(animation, timing.duration + (timing.delay || 0));
    pageEffects.delete(animation);
    animation.cancel();
  }

  function cancelPages() {
    pageEffects.forEach(animation => animation.cancel());
    pageEffects.clear();
  }

  async function unfoldPages() {
    const pages = content.querySelector('.resource-detail-copy');
    const sections = [...content.querySelectorAll('.learning-detail-section')];
    await Promise.all([
      animatePage(pages, [
        { opacity: 0, transform: 'perspective(1400px) rotateY(-24deg) translateX(-12px)' },
        { opacity: 1, transform: 'perspective(1400px) rotateY(0deg) translateX(0)' },
      ], { duration: 480, delay: 140 }),
      ...sections.map((section, index) => animatePage(section, [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 340, delay: 220 + Math.min(index, 2) * 30 })),
    ]);
  }

  function cancelFlight() {
    effect?.cancel();
    effect = null;
    ghost?.remove();
    ghost = null;
  }

  async function fly(from, to, face, returning = false) {
    if (motion.matches || !from || !to || !face || !from.width || !to.width) return;
    ghost = document.createElement('div');
    ghost.className = 'book-flight';
    ghost.setAttribute('aria-hidden', 'true');
    const clone = face.cloneNode(true);
    clone.classList.remove('is-in-flight');
    clone.removeAttribute('id');
    ghost.append(clone);
    Object.assign(ghost.style, { left: `${from.x}px`, top: `${from.y}px`, width: `${from.width}px`, height: `${from.height}px` });
    dialog.append(ghost);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const flightGhost = ghost;
    const flightEffect = ghost.animate([
      { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)' },
      { transform: `translate3d(${dx * 0.3}px,${dy * 0.3 - 12}px,0) scale(1.04) rotate(${returning ? 1 : -2}deg)`, offset: 0.3 },
      { transform: `translate3d(${dx}px,${dy}px,0) scale(${to.width / from.width},${to.height / from.height}) rotate(0deg)` },
    ], { duration: returning ? 240 : 440, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' });
    effect = flightEffect;
    await finishWithin(flightEffect, returning ? 240 : 440);
    if (effect === flightEffect) cancelFlight();
    else flightGhost.remove();
  }

  function restorePage() {
    origin?.classList.remove('is-selected');
    if (savedOverflow !== undefined) {
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPadding;
      savedOverflow = undefined;
    }
  }

  async function close({ immediately = false } = {}) {
    if (!dialog.open || (closing && !immediately)) return;
    closing = true;
    const token = ++version;
    // Reverse from the cover's current location if the opening is interrupted.
    const flyingRect = ghost?.getBoundingClientRect();
    const flyingFace = ghost?.firstElementChild?.cloneNode(true);
    cancelFlight();
    cancelPages();
    dialog.classList.remove('is-opening');
    dialog.classList.add('is-closing');
    const cover = content.querySelector('.resource-detail-cover');
    const target = origin?.querySelector('.book-object, .index-row-cover, .index-row-cover-fallback');
    const rect = target?.getBoundingClientRect();
    const coverRect = cover?.getBoundingClientRect();
    if (!immediately) {
      const visibleCover = coverRect && coverRect.top >= dialog.getBoundingClientRect().top && coverRect.bottom > 0;
      await Promise.all([
        animatePage(content, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }),
        animatePage(dialog, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }),
        rect && rect.top >= 0 && rect.bottom <= innerHeight && (flyingRect || visibleCover)
          ? fly(flyingRect || coverRect, rect, flyingFace || cover, true)
          : Promise.resolve(),
      ]);
    }
    if (token !== version || disposed) return;
    restorePage();
    dialog.close();
    dialog.classList.remove('is-closing');
    origin?.focus({ preventScroll: true });
    closing = false;
  }

  async function open(link, resource) {
    if (dialog.open || disposed) return;
    const token = ++version;
    origin = link;
    dialog.dataset.resource = resource.slug;
    notice.hidden = true;
    content.innerHTML = renderDetail(resource, [], { loadingNotes: true });
    permalink.href = link.href;
    const source = link.querySelector('.book-object, .index-row-cover, .index-row-cover-fallback');
    const rect = source?.getBoundingClientRect();
    savedOverflow = document.body.style.overflow;
    savedPadding = document.body.style.paddingRight;
    const scrollbar = innerWidth - document.documentElement.clientWidth;
    const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.paddingRight = `${padding + scrollbar}px`;
    document.body.style.overflow = 'hidden';
    dialog.classList.add('is-opening');
    dialog.showModal();
    dialog.scrollTop = 0;
    link.classList.add('is-selected');
    // Handle rejection immediately, even if the reader closes before the flight ends.
    const request = loadResource(resource.slug).then(data => ({ data }), error => ({ error }));
    const destination = content.querySelector('.resource-detail-cover');
    const coverFlight = fly(rect, destination?.getBoundingClientRect(), source?.querySelector('.book-face') || source);
    if (ghost) destination?.classList.add('is-in-flight');
    const showCover = coverFlight.then(() => {
      if (version === token) destination?.classList.remove('is-in-flight');
    });
    await Promise.all([showCover, unfoldPages()]);
    if (version !== token || !dialog.open) return;
    dialog.classList.remove('is-opening');
    const result = await request;
    if (version !== token || !dialog.open) return;
    if (result.error || !result.data.resource) {
      const pending = content.querySelector('#resourceNotesTitle + .index-empty');
      if (pending) pending.textContent = 'Related notes are unavailable right now.';
      notice.textContent = 'Could not refresh this resource. Your saved details are still available.';
      notice.hidden = false;
      return;
    }
    const updated = document.createElement('div');
    updated.innerHTML = renderDetail(result.data.resource, result.data.notes);
    // The index already carries the full resource. Usually only notes need updating;
    // keep the cover and reader DOM in place to avoid image flashes and scroll jumps.
    if (JSON.stringify(resource) === JSON.stringify(result.data.resource)) {
      content.querySelector('[aria-labelledby="resourceNotesTitle"]')?.replaceWith(updated.querySelector('[aria-labelledby="resourceNotesTitle"]'));
    } else {
      const scrollTop = dialog.scrollTop;
      const focusedHref = content.contains(document.activeElement) ? document.activeElement.getAttribute('href') : null;
      content.replaceChildren(...updated.childNodes);
      dialog.scrollTop = scrollTop;
      if (focusedHref) [...content.querySelectorAll('a')].find(a => a.getAttribute('href') === focusedHref)?.focus({ preventScroll: true });
    }
  }

  const activate = event => {
    const link = event.target.closest('a[data-resource]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const resource = findResource(link.dataset.resource);
    if (!resource || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    open(link, resource);
  };
  const recoverCover = event => {
    if (event.target.tagName !== 'IMG') return;
    const face = event.target.closest('.book-face, .resource-detail-cover');
    if (!face) return;
    const resource = findResource(face.closest('[data-resource]')?.dataset.resource || dialog.dataset.resource);
    if (!resource) return;
    face.classList.add('book-face-fallback');
    const title = document.createElement('span');
    title.className = 'book-cover-title';
    title.textContent = resource.title;
    face.replaceChildren(title);
  };
  root.addEventListener('error', recoverCover, true);
  dialog.addEventListener('error', recoverCover, true);
  root.addEventListener('click', activate);
  closeButton.addEventListener('click', () => close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
      .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    if (!focusable.length) return;
    // Safari may skip links in its default Tab order; keep this reader consistent.
    const index = focusable.indexOf(document.activeElement);
    const next = index < 0 ? 0 : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
    event.preventDefault();
    focusable[next].focus();
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return; // A queued close event must not cancel a new opening.
    cancelFlight(); cancelPages(); restorePage();
  });
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog && outside(event); });
  dialog.addEventListener('pointerup', event => {
    if (backdropDown && event.target === dialog && outside(event)) close();
    backdropDown = false;
  });
  const finishMotion = () => { effect?.finish(); pageEffects.forEach(animation => animation.finish()); };
  const onMotionChange = () => { if (motion.matches) finishMotion(); };
  const onPageHide = () => { close({ immediately: true }); };
  window.addEventListener('resize', finishMotion);
  window.addEventListener('pagehide', onPageHide);
  motion.addEventListener('change', onMotionChange);
  return () => {
    disposed = true;
    version++;
    cancelFlight();
    cancelPages();
    restorePage();
    root.removeEventListener('click', activate);
    root.removeEventListener('error', recoverCover, true);
    window.removeEventListener('resize', finishMotion);
    window.removeEventListener('pagehide', onPageHide);
    motion.removeEventListener('change', onMotionChange);
    dialog.remove();
  };
}
