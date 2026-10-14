import { createCardAudio } from './cardAudio.js';

const DURATION = 3000;
const EASING = 'cubic-bezier(0.45, 0, 0.2, 1)';
// The final face-down keyframe for fan, riffle and Hindu respectively.
const FINAL_TURN = [0.81, 0.85, 0.87];
// With EASING, half the rotation occurs at x(.5), since y(.5) === .5.
const HALF_TURN_TIME = 0.36875;
// Nick's supplied photos only. The original is always the initial/reduced-motion face.
const PORTRAIT_PHOTOS = [
  '/nick-pixel-source.jpg',
  '/nick-waterfall-summer.jpg',
  '/nick-mirror.jpg',
  '/nick-snow.jpg',
  '/nick-waterfall-autumn.jpg',
  '/nick-business-portrait.jpg',
];

// Keep the portrait's existing integration point; the old free-body puzzle
// physics is replaced with bounded, interaction-driven card choreography.
export function createCardPortrait({ hero, shell, image }) {
  const audio = createCardAudio();
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...shell.querySelectorAll('.portrait-card')];
  let animations = [];
  let ready = false;
  let visible = true;
  let suspended = document.hidden;
  let lastVariation = -1;
  let generation = 0;
  let bag = [];
  shell.dataset.state = 'idle';
  let photoIndex = 0;
  const loadedPhotos = new Map([[PORTRAIT_PHOTOS[0], image]]);
  let pendingPhoto = null;
  const photoFrame = image.parentElement;
  image.classList.add('portrait-photo');
  // Keep the actual decoded image nodes: no network/decode work at reveal time.
  // Alternates are only seen after a shuffle, so they load once the page is
  // idle, and not at all for reduced-motion or Save-Data visitors.
  let photosRequested = false;
  function preloadPhotos() {
    if (photosRequested || motionQuery.matches || window.navigator?.connection?.saveData) return;
    photosRequested = true;
    PORTRAIT_PHOTOS.slice(1).forEach(src => {
      const preload = new Image();
      preload.alt = '';
      preload.className = 'portrait-photo';
      preload.src = src;
      preload.decode().then(() => loadedPhotos.set(src, preload)).catch(() => {});
    });
  }
  // Alternates are only needed once someone shuffles; let the page settle
  // first, then load them in an idle moment.
  const whenIdle = callback => window.requestIdleCallback
    ? window.requestIdleCallback(callback, { timeout: 2000 })
    : callback();
  if (window.setTimeout) window.setTimeout(() => whenIdle(preloadPhotos), DURATION);
  else preloadPhotos();

  function preparePhoto(variation) {
    if (motionQuery.matches || loadedPhotos.size < 2) return;
    for (let step = 1; step < PORTRAIT_PHOTOS.length; step += 1) {
      const next = (photoIndex + step) % PORTRAIT_PHOTOS.length;
      const node = loadedPhotos.get(PORTRAIT_PHOTOS[next]);
      if (!node) continue;
      pendingPhoto = { index: next, node };
      // Mount the decoded node ahead of time so the final reveal never needs
      // a DOM insertion, src change, decode, or a new image animation.
      node.style.opacity = '0';
      photoFrame.append(node);
      animations.push(node.animate([
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: FINAL_TURN[variation], easing: 'steps(1, start)' },
        { opacity: 1, offset: 1 },
      ], { duration: DURATION, fill: 'both' }));
      break;
    }
  }

  function maskPhotoWhileFaceDown(variation) {
    const firstTurn = variation === 1 ? 0.16 : 0.17;
    const finalTurn = FINAL_TURN[variation];
    // Explicitly mask the image while the Joker faces away. Safari can
    // composite image layers through a backface-hidden ancestor. Reveal just
    // after the final turn passes 90 degrees, with the new photo already in
    // place. This uses the same WAAPI clock as the transforms, not a timeout.
    animations.push(photoFrame.animate([
      { opacity: 1, offset: 0, easing: 'steps(1, end)' },
      { opacity: 0, offset: firstTurn * HALF_TURN_TIME, easing: 'steps(1, end)' },
      { opacity: 1, offset: finalTurn + (1 - finalTurn) * HALF_TURN_TIME + 0.001 },
      { opacity: 1, offset: 1 },
    ], { duration: DURATION, fill: 'both' }));
  }

  const canAnimate = () => ready && visible && !suspended && !motionQuery.matches;
  const home = (index) => `translate(${(index - 4) * 2}px, ${(4 - index) * 2}px) rotate(0deg) rotateY(${index === 4 ? 0 : 180}deg) scale(1)`;
  const pose = (x, y, rotation, flip = 0) =>
    `translate(${x}%, ${y}%) rotate(${rotation}deg) rotateY(${flip}deg) scale(0.88)`;

  function nextVariation() {
    if (!bag.length) {
      bag = [0, 1, 2];
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const pick = Math.floor(Math.random() * (index + 1));
        [bag[index], bag[pick]] = [bag[pick], bag[index]];
      }
      if (bag[0] === lastVariation) [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    lastVariation = bag.shift();
    return lastVariation;
  }

  function framesFor(index, variation) {
    const rest = home(index);
    const closed = pose((index - 2) * 0.7, (4 - index) * 0.6, 0, 180);
    const face = index === 4 ? 180 : 0;
    const frame = (offset, transform, zIndex = index) => ({ offset, transform, zIndex });
    if (variation === 0) {
      const rank = index - 2;
      return [
        frame(0, rest), frame(0.17, closed),
        frame(0.4, pose(rank * 11, Math.abs(rank) * 2.5 - 4, rank * 12, face)),
        frame(0.59, pose(rank * 11, Math.abs(rank) * 2.5 - 4, rank * 12, face)),
        frame(FINAL_TURN[variation], closed), frame(1, rest),
      ];
    }
    if (variation === 1) {
      // Two packets hinge inward, release alternating cards, then square up.
      // The release times, rather than whole-card delays, define the riffle.
      const side = index % 2 === 0 ? -1 : 1;
      const packet = pose(side * 24, 0, side * 8, 180);
      const bent = `${pose(side * 24, -1, side * 8, face)} rotateX(16deg)`;
      const release = 0.42 + index * 0.045;
      return [
        frame(0, rest), frame(0.16, closed), frame(0.31, packet),
        frame(0.4, bent), frame(release, bent),
        frame(release + 0.065, `${pose(side * 4, (4 - index) * 0.7, side * 2, face)} rotateX(0deg)`, index + 5),
        frame(0.76, pose(0, (4 - index) * 0.7, 0, face), index + 5),
        frame(FINAL_TURN[variation], closed), frame(1, rest),
      ];
    }
    // Hindu shuffle: successive small packets are pulled lengthwise from the
    // held deck and caught in a receiving pile below it. No lateral riffle.
    const pull = 0.27 + index * 0.085;
    const held = pose(3, -8, 3, 180);
    const caught = pose(-4, 6 + (4 - index) * 0.5, -2, face);
    return [
      frame(0, rest), frame(0.17, closed), frame(0.25, held),
      frame(pull, held),
      frame(pull + 0.055, pose(-6, 5, -4, face), index + 5),
      frame(pull + 0.11, caught, index + 5),
      frame(0.78, caught, index + 5), frame(FINAL_TURN[variation], closed), frame(1, rest),
    ];
  }

  function settle({ completed = false } = {}) {
    audio.stop();
    generation += 1;
    if (pendingPhoto) {
      // Nodes are reused, including the original on cycle wraparound. Clear
      // staging styles on cancellation too, before reduced motion restores it.
      pendingPhoto.node.style.removeProperty('opacity');
      if (completed) {
        image.removeAttribute('id');
        image.remove();
        image = pendingPhoto.node;
        image.id = 'portraitSource';
        photoIndex = pendingPhoto.index;
      } else {
        pendingPhoto.node.remove();
      }
      pendingPhoto = null;
    }
    animations.forEach((animation) => animation.cancel());
    animations = [];
    trick = null;
    shell.dataset.state = 'idle';
  }

  // Transforms and z-index run as separate animations on the same clock and
  // easing: z-index cannot run on the compositor, and sharing an animation
  // with it would pull the card motion back onto the main thread.
  // A click or tap always asks for sound (audio may still be resuming from the
  // same gesture); hover and Pokemon only get it once sound is already on.
  let trick = null;
  function shuffle({ sound = audio.canPlay() } = {}) {
    if (!canAnimate() || animations.length) return;
    const variation = nextVariation();
    const currentGeneration = ++generation;
    shell.dataset.state = 'shuffling';
    shell.dataset.shuffle = ['fan', 'riffle', 'hindu'][variation];
    const timing = { duration: DURATION, delay: 0, easing: 'linear', fill: 'both' };
    animations = cards.flatMap((card, index) => {
      const frames = framesFor(index, variation);
      return [
        card.animate(frames.map(({ offset, transform }) => ({ offset, transform, easing: EASING })), timing),
        card.animate(frames.map(({ offset, zIndex }) => ({ offset, zIndex, easing: EASING })), timing),
      ];
    });
    preparePhoto(variation);
    maskPhotoWhileFaceDown(variation);
    const startTime = document.timeline.currentTime;
    animations.forEach(animation => { animation.startTime = startTime; });
    trick = { variation, startTime, sound };
    if (trick.sound) audio.play(variation, startTime);
    Promise.all(animations.map((animation) => animation.finished)).then(() => {
      if (generation === currentGeneration) settle({ completed: true });
    }).catch(() => { /* Visibility and motion changes cancel back to the crisp photo. */ });
  }

  function pause() {
    suspended = true;
    settle();
  }

  function resume() {
    suspended = document.hidden;
  }

  // Pokemon contact follows the same in-flight guard as direct interaction.
  function disturb(x, y, radius = 120) {
    const rect = shell.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    const centerX = rect.left - heroRect.left + rect.width / 2;
    const centerY = rect.top - heroRect.top + rect.height / 2;
    if (Math.hypot(centerX - x, centerY - y) < radius + rect.width / 2) shuffle();
  }

  // Only three things start a trick: a click or tap on the deck, the cursor
  // actually moving over it, or a Pokemon walking into it. Browsers also send
  // pointer events when the page moves under a still cursor (a menu closing,
  // a scroll, a resize); those arrive at the last known position and are
  // ignored, so a click elsewhere on the page never sets the deck off.
  // Pointer activity may replay a settled deck, but never queues a replay or
  // restarts an in-flight shuffle.
  let cursor = null;
  let pointer = null;
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch') cursor = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  shell.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const next = { x: event.clientX, y: event.clientY };
    const moved = cursor && (cursor.x !== next.x || cursor.y !== next.y);
    if (!moved) return;
    const distance = pointer ? Math.hypot(next.x - pointer.x, next.y - pointer.y) : Infinity;
    if (distance < 12) return;
    pointer = next;
    shuffle();
  });
  shell.addEventListener('pointerleave', () => { pointer = null; });
  // Native button click handles mouse, touch and keyboard once. Touch hover
  // is ignored above; no pointer-up handler or queued replay duplicates a tap.
  // A click during a trick that started without sound (hover or a Pokemon
  // before sound was allowed) adds the sound if its cue has not passed yet.
  // The click has already unlocked audio in the capture phase below.
  shell.addEventListener('click', () => {
    if (trick && !trick.sound) {
      trick.sound = true;
      audio.play(trick.variation, trick.startTime);
      return;
    }
    shuffle({ sound: true });
  });
  // Capture runs before the button click starts its trick. touchend is kept
  // explicitly for iPhone Safari; pointer hover never unlocks audio.
  const unlockAudio = (event) => { if (event.isTrusted) audio.unlock(); };
  document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
  document.addEventListener('touchend', unlockAudio, { capture: true, passive: true });
  document.addEventListener('click', unlockAudio, { capture: true, passive: true });
  document.addEventListener('keydown', unlockAudio, { capture: true });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) settle();
  });
  observer.observe(shell);

  motionQuery.addEventListener('change', () => {
    settle();
    preloadPhotos();
    if (motionQuery.matches) {
      photoIndex = 0;
      const original = loadedPhotos.get(PORTRAIT_PHOTOS[0]);
      if (image !== original) {
        image.removeAttribute('id');
        image.replaceWith(original);
        image = original;
        image.id = 'portraitSource';
      }
    }
  });

  // The deck stays still on load; it only moves when someone plays with it.
  function init() {
    ready = true;
  }
  if (image.complete && image.naturalWidth) init();
  else image.addEventListener('load', init, { once: true });

  return { disturb, scatterFrom: () => shuffle(), pause, resume };
}
