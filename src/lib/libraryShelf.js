// Enhance real detail-page links with a book that leaves the shelf, opens, and
// turns its pages. Every step is reversible, interruptible and skipped with
// reduced motion; the links still lead to full detail pages without script.
export function initializeLibraryShelf(root, { findResource, loadResource, renderPages }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'library-reader';
  dialog.setAttribute('aria-labelledby', 'library-reader-title');
  dialog.innerHTML = `<div class="reader-toolbar">
    <button type="button" class="reader-close" autofocus><span aria-hidden="true">←</span> Return to shelf</button>
    <a class="reader-permalink">Open full page <span aria-hidden="true">↗</span></a>
    </div>
    <div class="reader-content"><div class="reader-book"></div></div>
    <div class="reader-nav">
      <button type="button" class="page-turn" data-turn="-1" aria-label="Previous page"><span aria-hidden="true">←</span></button>
      <p class="reader-position" aria-live="polite"></p>
      <button type="button" class="page-turn" data-turn="1" aria-label="Next page"><span aria-hidden="true">→</span></button>
    </div>
    <p class="reader-notice" role="status" hidden></p>`;
  document.body.append(dialog);
  const content = dialog.querySelector('.reader-content');
  const book = dialog.querySelector('.reader-book');
  const notice = dialog.querySelector('.reader-notice');
  const closeButton = dialog.querySelector('.reader-close');
  const permalink = dialog.querySelector('.reader-permalink');
  const position = dialog.querySelector('.reader-position');
  const [previousButton, nextButton] = dialog.querySelectorAll('.page-turn');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const spreadQuery = matchMedia('(min-width: 860px)');
  let origin;
  let version = 0;
  let effect;
  const pageEffects = new Set();
  const leaves = new Set();
  let ghost;
  let closing = false;
  let turning = false;
  let firstPage = 0;
  let savedOverflow;
  let savedPadding;
  let backdropDown = false;
  let swipe;
  let disposed = false;
  let pendingOpen = null;
  let chromeFades = [];
  // Sealed "new" items: unwrapped once per visitor, remembered in localStorage.
  const UNWRAP_PREFIX = 'nt-unwrapped:';
  const sealObservers = new Set();
  const alreadyUnwrapped = slug => { try { return Boolean(localStorage.getItem(UNWRAP_PREFIX + slug)); } catch { return false; } };
  const markUnwrapped = slug => { try { localStorage.setItem(UNWRAP_PREFIX + slug, '1'); } catch { /* Private mode: unwrap again next time. */ } };
  function unwrap(item, slug) {
    if (!item.classList.contains('is-sealed') || item.classList.contains('is-unwrapping')) return;
    markUnwrapped(slug);
    item.classList.add('is-unwrapping');
    const done = () => { item.classList.remove('is-sealed', 'is-unwrapping'); item.classList.add('is-unwrapped'); };
    const seal = item.querySelector('.book-seal');
    if (!seal || motion.matches) { done(); return; }
    const timer = setTimeout(done, 1500);
    seal.addEventListener('animationend', event => {
      if (event.animationName !== 'seal-tear-b') return;
      clearTimeout(timer);
      done();
    });
  }
  function initSeals() {
    root.querySelectorAll('.shelf-item.is-new:not([data-seal])').forEach(item => {
      item.dataset.seal = 'ready';
      const slug = item.querySelector('.shelf-link')?.dataset.resource;
      if (!slug || alreadyUnwrapped(slug) || motion.matches) { item.classList.add('is-unwrapped'); return; }
      item.classList.add('is-sealed');
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        sealObservers.delete(observer);
        // Let the visitor register the sealed item before it tears open.
        setTimeout(() => unwrap(item, slug), 700);
      }, { threshold: 0.6 });
      observer.observe(item);
      sealObservers.add(observer);
    });
  }
  initSeals();
  const shelfChanges = new MutationObserver(initSeals);
  shelfChanges.observe(root, { childList: true, subtree: true });
  let keyboardInput = false;
  const noteKeyboard = () => { keyboardInput = true; };
  const notePointer = event => {
    keyboardInput = false;
    if (event.pointerType === 'touch') root.querySelector('.library-shelf')?.classList.add('is-touch');
  };
  document.addEventListener('keydown', noteKeyboard, true);
  document.addEventListener('pointerdown', notePointer, true);

  const pages = () => [...book.querySelectorAll('.reader-page')];
  const perView = () => (spreadQuery.matches ? 2 : 1);

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
    const animation = element.animate(frames, { easing: 'cubic-bezier(.22,.7,.2,1)', ...timing, fill: 'both' });
    pageEffects.add(animation);
    await finishWithin(animation, timing.duration + (timing.delay || 0));
    pageEffects.delete(animation);
    animation.cancel();
  }

  function cancelPages() {
    book.classList.remove('is-closed');
    pageEffects.forEach(animation => animation.cancel());
    pageEffects.clear();
    leaves.forEach(leaf => leaf.remove());
    leaves.clear();
    pages().forEach(page => page.style.removeProperty('visibility'));
    turning = false;
  }

  // Show the spread (or single page) starting at `first`; others are inert.
  function showPages(first) {
    const all = pages();
    const step = perView();
    firstPage = Math.max(0, Math.min(first - (first % step), all.length - step));
    all.forEach((page, index) => {
      const visible = index >= firstPage && index < firstPage + step;
      page.hidden = !visible;
      page.inert = !visible;
      page.dataset.side = !visible ? '' : step === 2 ? (index === firstPage ? 'left' : 'right') : 'single';
      page.dataset.number = String(index + 1);
      if (visible) page.scrollTop = 0;
    });
    // A page with more than fits scrolls; keyboard users need to reach it.
    requestAnimationFrame(() => all.forEach(page => {
      if (!page.hidden && page.scrollHeight > page.clientHeight + 1) page.tabIndex = 0;
      else page.removeAttribute('tabindex');
    }));
    previousButton.disabled = firstPage === 0;
    nextButton.disabled = firstPage + step >= all.length;
    if (previousButton.disabled && document.activeElement === previousButton) nextButton.focus();
    if (nextButton.disabled && document.activeElement === nextButton) previousButton.focus();
    if (book.contains(document.activeElement) && document.activeElement.closest('.reader-page')?.hidden) {
      (nextButton.disabled ? previousButton : nextButton).focus();
    }
    const last = Math.min(firstPage + step, all.length);
    position.textContent = step === 2 ? `Pages ${firstPage + 1}–${last} of ${all.length}` : `Page ${firstPage + 1} of ${all.length}`;
  }

  // A leaf is a two-sided page that rotates on the spine during a turn.
  function makeLeaf(rect, front, back, hinge) {
    const leaf = document.createElement('div');
    leaf.className = `book-leaf book-leaf--${hinge}`;
    leaf.setAttribute('aria-hidden', 'true');
    leaf.innerHTML = '<div class="book-leaf-face book-leaf-front"><i class="book-leaf-shade"></i></div><div class="book-leaf-face book-leaf-back"><i class="book-leaf-shade"></i></div>';
    if (front) leaf.firstElementChild.prepend(front);
    if (back) leaf.lastElementChild.prepend(back);
    Object.assign(leaf.style, {
      left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
    });
    dialog.append(leaf);
    leaves.add(leaf);
    return leaf;
  }

  function pageClone(page) {
    const clone = page.cloneNode(true);
    clone.hidden = false;
    clone.inert = true;
    clone.style.removeProperty('visibility');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    clone.classList.add('is-clone');
    return clone;
  }

  async function swing(leaf, from, to, duration = 720) {
    const shades = [...leaf.querySelectorAll('.book-leaf-shade')].map(shade => shade.animate([
      { opacity: 0 }, { opacity: 0.7, offset: 0.5 }, { opacity: 0 },
    ], { duration, fill: 'both' }));
    shades.forEach(shade => pageEffects.add(shade));
    await animatePage(leaf, [
      { transform: `perspective(2200px) rotateY(${from}deg)` },
      { transform: `perspective(2200px) rotateY(${to}deg)` },
    ], { duration, easing: 'cubic-bezier(.45,.05,.25,1)' });
    shades.forEach(shade => { shade.cancel(); pageEffects.delete(shade); });
  }

  async function turn(direction) {
    const all = pages();
    const step = perView();
    const target = firstPage + direction * step;
    if (turning || closing || dialog.classList.contains('is-opening') || target < 0 || target >= all.length) return;
    const token = version;
    // Announce page turns, but not the initial position on opening.
    position.setAttribute('aria-live', 'polite');
    if (motion.matches) { showPages(target); return; }
    turning = true;
    const current = all.filter(page => !page.hidden);
    if (step === 2) {
      // Next: the right page lifts and lands as the next left page.
      // Previous: the left page lifts back and lands as the previous right page.
      const lifting = direction > 0 ? current[1] : current[0];
      const rect = lifting.getBoundingClientRect();
      const landing = all[direction > 0 ? target : target + 1];
      const leaf = makeLeaf(rect, pageClone(lifting), pageClone(landing), direction > 0 ? 'left' : 'right');
      showPages(target);
      // Until the leaf lands, the page it carries stays hidden beneath it.
      landing.style.visibility = 'hidden';
      await swing(leaf, 0, direction > 0 ? -180 : 180);
      landing.style.removeProperty('visibility');
      leaf.remove();
      leaves.delete(leaf);
    } else {
      // Single page: the current page turns away to reveal the next, or the
      // previous page turns back over the current one.
      const rect = current[0].getBoundingClientRect();
      if (direction > 0) {
        const leaf = makeLeaf(rect, pageClone(current[0]), null, 'left');
        showPages(target);
        await swingAway(leaf);
        leaf.remove(); leaves.delete(leaf);
      } else {
        const leaf = makeLeaf(rect, pageClone(all[target]), null, 'left');
        await swingBack(leaf);
        showPages(target);
        leaf.remove(); leaves.delete(leaf);
      }
    }
    if (token === version) turning = false;
  }

  async function swingAway(leaf, duration = 560) {
    await animatePage(leaf, [
      { transform: 'perspective(1600px) rotateY(0deg)', opacity: 1 },
      { transform: 'perspective(1600px) rotateY(-62deg)', opacity: 1, offset: 0.62 },
      { transform: 'perspective(1600px) rotateY(-88deg)', opacity: 0, offset: 0.92 },
      { transform: 'perspective(1600px) rotateY(-96deg)', opacity: 0 },
    ], { duration, easing: 'cubic-bezier(.4,.05,.3,1)' });
  }

  async function swingBack(leaf, duration = 560) {
    await animatePage(leaf, [
      { transform: 'perspective(1600px) rotateY(-96deg)', opacity: 0 },
      { transform: 'perspective(1600px) rotateY(-88deg)', opacity: 0, offset: 0.08 },
      { transform: 'perspective(1600px) rotateY(-62deg)', opacity: 1, offset: 0.38 },
      { transform: 'perspective(1600px) rotateY(0deg)', opacity: 1 },
    ], { duration, easing: 'cubic-bezier(.4,.05,.3,1)' });
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
    clone.removeAttribute('id');
    ghost.append(clone);
    Object.assign(ghost.style, { left: `${from.x}px`, top: `${from.y}px`, width: `${from.width}px`, height: `${from.height}px` });
    dialog.append(ghost);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const flightGhost = ghost;
    const duration = returning ? 280 : 520;
    const flightEffect = ghost.animate([
      { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)' },
      { transform: `translate3d(${dx * 0.3}px,${dy * 0.3 - 18}px,0) scale(${1 + (to.width / from.width - 1) * 0.25}) rotate(${returning ? 1 : -2}deg)`, offset: 0.3 },
      { transform: `translate3d(${dx}px,${dy}px,0) scale(${to.width / from.width},${to.height / from.height}) rotate(0deg)` },
    ], { duration, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' });
    effect = flightEffect;
    await finishWithin(flightEffect, duration);
    if (effect === flightEffect) cancelFlight();
    else flightGhost.remove();
  }

  // The closed book's position in the reader: the right-hand page of a spread,
  // or the single page on narrow screens.
  function coverSlot() {
    const visible = pages().filter(page => !page.hidden);
    const page = (visible[1] || visible[0])?.getBoundingClientRect();
    if (!page) return page;
    const width = Math.min(page.width, page.height * 2 / 3);
    const height = width * 1.5;
    return { x: page.x + (page.width - width) / 2, y: page.y + (page.height - height) / 2, width, height, left: page.x + (page.width - width) / 2, top: page.y + (page.height - height) / 2 };
  }

  function coverFace(source) {
    const face = source?.querySelector('.book-face') || source;
    if (!face) return null;
    const clone = face.cloneNode(true);
    clone.classList.add('book-leaf-cover');
    return clone;
  }

  function restorePage() {
    origin?.classList.remove('is-selected', 'is-lifting');
    if (savedOverflow !== undefined) {
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPadding;
      savedOverflow = undefined;
    }
  }

  async function close({ immediately = false, viaKeyboard = false } = {}) {
    if (!dialog.open || (closing && !immediately)) return;
    closing = true;
    const token = ++version;
    // Reverse from the cover's current location if the opening is interrupted.
    const flyingRect = ghost?.getBoundingClientRect();
    const flyingFace = ghost?.firstElementChild?.cloneNode(true);
    cancelFlight();
    cancelPages();
    dialog.classList.remove('is-opening');
    const target = origin?.querySelector('.book-object, .index-row-cover, .index-row-cover-fallback');
    const rect = target?.getBoundingClientRect();
    const onScreen = rect && rect.top >= 0 && rect.bottom <= innerHeight;
    if (!immediately && !motion.matches) {
      // The panel, backdrop and controls fade at once (CSS); the book itself
      // stays fully visible while it folds shut and returns to the shelf.
      dialog.classList.add('is-closing');
      chromeFades = [...dialog.querySelectorAll('.reader-toolbar, .reader-nav, .reader-notice')]
        .map(element => element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease', fill: 'forwards' }));
      let from = flyingRect;
      let face = flyingFace;
      const visible = pages().filter(page => !page.hidden);
      if (!from && visible.length === 2 && onScreen) {
        // Fold the left page shut over the right, landing cover-up.
        const leaf = makeLeaf(visible[0].getBoundingClientRect(), pageClone(visible[0]), coverFace(target), 'right');
        visible[0].style.visibility = 'hidden';
        await swing(leaf, 0, 180, 340);
        if (token !== version) return;
        from = visible[1].getBoundingClientRect();
        face = leaf.querySelector('.book-leaf-back')?.firstElementChild?.cloneNode(true);
        leaf.remove(); leaves.delete(leaf);
      } else if (!from && onScreen) {
        from = coverSlot();
        face = coverFace(target);
      }
      // The flying cover now carries the book; hide the pages it left behind.
      if (from && onScreen) content.style.opacity = '0';
      await Promise.all([
        from && onScreen ? Promise.resolve() : animatePage(content, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }),
        onScreen && from ? fly(from, rect, face, true) : Promise.resolve(),
        // Let the panel's own fade finish so it never pops out at the end.
        new Promise(resolve => setTimeout(resolve, 300)),
      ]);
    }
    if (token !== version || disposed) return;
    cancelPages();
    restorePage();
    dialog.close();
    dialog.classList.remove('is-closing');
    chromeFades.forEach(fade => fade.cancel());
    chromeFades = [];
    content.style.removeProperty('opacity');
    if (origin) {
      if (!viaKeyboard) {
        const link = origin;
        link.classList.add('no-peek');
        link.addEventListener('blur', () => link.classList.remove('no-peek'), { once: true });
      }
      origin.focus({ preventScroll: true });
    }
    closing = false;
  }

  function renderBook(resource, notes, options) {
    book.innerHTML = renderPages(resource, notes, options).join('');
  }

  function cancelPendingOpen() {
    if (!pendingOpen) return;
    version++;
    pendingOpen.classList.remove('is-lifting');
    pendingOpen = null;
  }

  async function open(link, resource) {
    if (dialog.open || pendingOpen || disposed) return;
    const token = ++version;
    origin = link;
    closing = false;
    content.style.removeProperty('opacity');
    dialog.dataset.resource = resource.slug;
    dialog.dataset.rarity = link.dataset.rarity || 'common';
    notice.hidden = true;
    renderBook(resource, [], { loadingNotes: true });
    position.setAttribute('aria-live', 'off');
    showPages(0);
    permalink.href = link.href;
    const source = link.querySelector('.book-object, .index-row-cover, .index-row-cover-fallback');
    let rect = source?.getBoundingClientRect();
    if (!motion.matches && source && rect?.width) {
      // A hovered book is tilted with its cover ajar; let it settle flat so the
      // flying copy starts exactly where the book is.
      link.classList.add('is-lifting');
      pendingOpen = link;
      await new Promise(resolve => setTimeout(resolve, 170));
      if (token !== version || disposed || dialog.open || !link.isConnected) { link.classList.remove('is-lifting'); return; }
      pendingOpen = null;
      rect = source.getBoundingClientRect();
    }
    savedOverflow = document.body.style.overflow;
    savedPadding = document.body.style.paddingRight;
    const scrollbar = innerWidth - document.documentElement.clientWidth;
    const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.style.paddingRight = `${padding + scrollbar}px`;
    document.body.style.overflow = 'hidden';
    dialog.classList.add('is-opening');
    dialog.showModal();
    dialog.scrollTop = 0;
    // Handle rejection immediately, even if the reader closes before the motion ends.
    const request = loadResource(resource.slug).then(data => ({ data }), error => ({ error }));

    const visible = pages().filter(page => !page.hidden);
    if (!motion.matches && rect?.width) {
      visible.forEach(page => { page.style.visibility = 'hidden'; });
      if (visible.length === 2) book.classList.add('is-closed');
    }
    link.classList.add('is-selected');

    if (!motion.matches && rect?.width) {
      const slot = coverSlot();
      const face = source.querySelector('.book-face') || source;
      // 1. The book leaves the shelf and lands, closed, where it will open.
      const navFade = animatePage(dialog.querySelector('.reader-nav'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 760 });
      await fly(rect, slot, face);
      if (token !== version || !dialog.open) return;
      // 2. The cover swings open on its spine. On a spread its inside becomes
      // the left (title) page; on one page it turns away to reveal it.
      const titlePage = visible[0];
      const spread = visible.length === 2;
      const landed = coverSlot() || slot;
      const leaf = makeLeaf(spread ? visible[1].getBoundingClientRect() : landed, coverFace(source), spread ? pageClone(titlePage) : null, 'left');
      const glow = getComputedStyle(dialog).getPropertyValue('--rarity-rgb').trim() || '89 241 215';
      const flash = animatePage(leaf.firstElementChild, [
        { boxShadow: `0 0 0 1px rgb(${glow} / 0), 0 0 0 0 rgb(${glow} / 0)` },
        { boxShadow: `0 0 0 1px rgb(${glow} / .9), 0 0 60px 6px rgb(${glow} / .55)`, offset: 0.35 },
        { boxShadow: `0 0 0 1px rgb(${glow} / .4), 0 0 20px 0 rgb(${glow} / .15)` },
      ], { duration: 560, easing: 'ease-out' });
      await new Promise(resolve => setTimeout(resolve, 160));
      if (token !== version || !dialog.open) return;
      book.classList.remove('is-closed');
      (spread ? visible[1] : titlePage).style.removeProperty('visibility');
      await Promise.all([spread ? swing(leaf, 0, -180, 760) : swingAway(leaf, 600), flash]);
      if (token !== version || !dialog.open) return;
      titlePage.style.removeProperty('visibility');
      leaf.remove(); leaves.delete(leaf);
      await navFade;
    }
    if (token !== version || !dialog.open) return;
    visible.forEach(page => page.style.removeProperty('visibility'));
    book.classList.remove('is-closed');
    dialog.classList.remove('is-opening');
    showPages(firstPage);

    const result = await request;
    if (version !== token || !dialog.open) return;
    if (result.error || !result.data.resource) {
      const pending = book.querySelector('#resourceNotesTitle + .index-empty');
      if (pending) pending.textContent = 'Related notes are unavailable right now.';
      notice.textContent = 'Could not refresh this resource. Your saved details are still available.';
      notice.hidden = false;
      return;
    }
    // The index already carries the full resource. Usually only notes need updating;
    // keep the cover and pages in place to avoid image flashes and jumps.
    if (JSON.stringify(resource) === JSON.stringify(result.data.resource)) {
      const holder = document.createElement('div');
      holder.innerHTML = renderPages(result.data.resource, result.data.notes).join('');
      book.querySelector('[aria-labelledby="resourceNotesTitle"]')?.replaceWith(holder.querySelector('[aria-labelledby="resourceNotesTitle"]'));
    } else {
      const focusedHref = book.contains(document.activeElement) ? document.activeElement.getAttribute('href') : null;
      renderBook(result.data.resource, result.data.notes);
      showPages(firstPage);
      if (focusedHref) [...book.querySelectorAll('a')].find(a => a.getAttribute('href') === focusedHref)?.focus({ preventScroll: true });
    }
  }

  const activate = event => {
    const link = event.target.closest('a[data-resource]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const resource = findResource(link.dataset.resource);
    if (!resource || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    const item = link.closest('.shelf-item');
    if (item?.classList.contains('is-sealed')) unwrap(item, resource.slug);
    open(link, resource);
  };

  // Hovered books lean toward the cursor; the sheen follows it.
  let tiltFrame = 0;
  let tiltEvent;
  const applyTilt = () => {
    tiltFrame = 0;
    const link = tiltEvent?.target.closest?.('.shelf-link');
    const object = link?.querySelector('.book-object');
    if (!object) return;
    const box = link.querySelector('.book-stage').getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (tiltEvent.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (tiltEvent.clientY - box.top) / box.height));
    object.style.setProperty('--tilt-y', `${((x - 0.5) * 16).toFixed(2)}deg`);
    object.style.setProperty('--tilt-x', `${((0.5 - y) * 10).toFixed(2)}deg`);
    object.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
    object.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
  };
  const onPointerMove = event => {
    if (event.pointerType === 'mouse') root.querySelector('.library-shelf')?.classList.remove('is-touch');
    if (event.pointerType !== 'mouse' || motion.matches) return;
    tiltEvent = event;
    if (!tiltFrame) tiltFrame = requestAnimationFrame(applyTilt);
  };
  const onPointerOut = event => {
    const link = event.target.closest?.('.shelf-link');
    if (!link || link.contains(event.relatedTarget)) return;
    const object = link.querySelector('.book-object');
    ['--tilt-x', '--tilt-y', '--glare-x', '--glare-y'].forEach(name => object?.style.removeProperty(name));
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
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerout', onPointerOut);
  closeButton.addEventListener('click', () => close({ viaKeyboard: keyboardInput }));
  previousButton.addEventListener('click', () => turn(-1));
  nextButton.addEventListener('click', () => turn(1));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close({ viaKeyboard: true }); });
  const onDocumentKeydown = event => {
    if (event.key === 'Escape' && pendingOpen) { cancelPendingOpen(); return; }
    if (!dialog.open || dialog.contains(event.target)) return;
    if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && !event.altKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      turn(event.key === 'ArrowRight' ? 1 : -1);
    }
  };
  document.addEventListener('keydown', onDocumentKeydown);
  dialog.addEventListener('keydown', event => {
    if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && !event.altKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      turn(event.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
      .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert], .book-leaf, .book-flight'));
    if (!focusable.length) return;
    // Safari may skip links in its default Tab order; keep this reader consistent.
    const index = focusable.indexOf(document.activeElement);
    const next = index < 0 ? 0 : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
    event.preventDefault();
    focusable[next].focus();
  });
  // Horizontal swipes turn pages on touch screens.
  book.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    swipe = { x: event.clientX, y: event.clientY, time: Date.now() };
  });
  book.addEventListener('pointerup', event => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - swipe.time < 700) turn(dx < 0 ? 1 : -1);
    swipe = null;
  });
  book.addEventListener('pointercancel', () => { swipe = null; });
  dialog.addEventListener('close', () => {
    if (dialog.open) return; // A queued close event must not cancel a new opening.
    cancelFlight(); cancelPages(); restorePage();
    chromeFades.forEach(fade => fade.cancel());
    chromeFades = [];
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
  const onLayoutChange = () => {
    finishMotion();
    if (dialog.open && !closing) showPages(firstPage);
  };
  const onPageHide = () => { close({ immediately: true }); };
  window.addEventListener('resize', finishMotion);
  spreadQuery.addEventListener('change', onLayoutChange);
  window.addEventListener('pagehide', onPageHide);
  motion.addEventListener('change', onMotionChange);
  return () => {
    disposed = true;
    shelfChanges.disconnect();
    sealObservers.forEach(observer => observer.disconnect());
    sealObservers.clear();
    cancelPendingOpen();
    version++;
    cancelFlight();
    cancelPages();
    restorePage();
    cancelAnimationFrame(tiltFrame);
    root.removeEventListener('click', activate);
    root.removeEventListener('error', recoverCover, true);
    root.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('keydown', noteKeyboard, true);
    document.removeEventListener('pointerdown', notePointer, true);
    root.removeEventListener('pointerout', onPointerOut);
    document.removeEventListener('keydown', onDocumentKeydown);
    window.removeEventListener('resize', finishMotion);
    spreadQuery.removeEventListener('change', onLayoutChange);
    window.removeEventListener('pagehide', onPageHide);
    motion.removeEventListener('change', onMotionChange);
    dialog.remove();
  };
}
