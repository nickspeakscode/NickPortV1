import { createTimelineParticles } from './lib/timelineParticles.ts';
import './timeline.css';
import { chapters } from './data/timeline.js';
import { createTimelineHorizon } from './lib/timelineHorizon.js';

const cardRank = rank => `<span class="chapter-card" aria-hidden="true"><span class="chapter-rank">${rank}</span><span class="chapter-suit">♠</span><span class="chapter-corner">${rank}</span></span>`;
// Keep the portfolio's navy stage, including on phones using light mode.
document.documentElement.dataset.timelineTheme = 'dark';

document.querySelector('#app').innerHTML = `
  <main class="timeline-track" style="--chapters: ${chapters.length}" aria-label="Nick’s life timeline">
    <div class="timeline-viewport">
      <header class="timeline-header">
        <h1 class="sr-only">My timeline</h1>
        <a class="timeline-exit" href="/#home" aria-label="Close timeline and return home">Close <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></a>
      </header>
      <div class="timeline-world">
        <div class="timeline-horizon" aria-hidden="true"></div>
        <div class="timeline-floor" aria-hidden="true"></div>
        <canvas class="timeline-mountains" aria-hidden="true"></canvas>
        <div class="timeline-scene">
          <button type="button" class="timeline-artwork" aria-label="Scatter the illustration and watch it return"><canvas class="timeline-particles" aria-hidden="true"></canvas></button>
          <span class="timeline-hover-hint" aria-hidden="true"><span class="hint-mouse">Move through the dots · Click to scatter</span><span class="hint-touch">Tap the dots to scatter</span></span>
        </div>
      </div>
      <nav class="timeline-chapters" aria-label="Timeline chapters">
        ${chapters.map((chapter, index) => `<button type="button" data-chapter="${index}" aria-label="Chapter ${index + 1}: ${chapter.title}"${index === 0 ? ' aria-current="step"' : ''}><span class="chapter-name">${chapter.label}</span>${cardRank(chapter.rank)}</button>`).join('')}
      </nav>
      <div class="timeline-story">
        ${chapters.map((chapter, index) => `<section class="story-chapter${index === 0 ? ' is-current' : ''}" aria-labelledby="title-${chapter.id}"${index ? ' inert aria-hidden="true"' : ''}>
          <p class="story-era"><span class="story-rank" aria-hidden="true">${chapter.rank} ♠</span> ${chapter.era}</p>
          <h2 id="title-${chapter.id}">${chapter.title}</h2>
          <p class="story-description">${chapter.text}</p>
        </section>`).join('')}
      </div>
      <footer class="timeline-controls">
        <div class="timeline-arrows"><button type="button" data-direction="-1" aria-label="Previous chapter" disabled>↑</button><button type="button" data-direction="1" aria-label="Next chapter">↓</button><span>Scroll or swipe to continue <kbd>↑</kbd><kbd>↓</kbd></span></div>
        <span class="timeline-counter" aria-hidden="true">A ♠ / ${chapters.at(-1).rank} ♠</span>
      </footer>
      <div class="timeline-progress" aria-hidden="true"><span></span></div>
      <p class="timeline-announcement" role="status" aria-live="polite"></p>
    </div>
  </main>`;

const viewport = document.querySelector('.timeline-viewport');
const world = document.querySelector('.timeline-world');
const artwork = document.querySelector('.timeline-artwork');
const horizon = createTimelineHorizon(document.querySelector('.timeline-mountains'), chapters);
const particles = createTimelineParticles(document.querySelector('.timeline-particles'), chapters, schedule);
const sections = [...document.querySelectorAll('.story-chapter')];
const buttons = [...document.querySelectorAll('[data-chapter]')];
const previous = document.querySelector('[data-direction="-1"]');
const next = document.querySelector('[data-direction="1"]');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const progressBar = document.querySelector('.timeline-progress span');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const last = chapters.length - 1;
const savedChapter = clamp(Number(history.state?.timelineChapter) || 0, 0, last);
let active = -1;
let current = savedChapter;
let target = savedChapter;
let frame = 0;
let lastFrame = 0;
let announcement;
let touch;
let transition;
let suppressArtClickUntil = 0;
let canvasVisible = true;
const wheelGesture = { last: 0, direction: 0, distance: 0, claimed: false };

function select(index) {
  if (active === index) return;
  active = index;
  history.replaceState({ ...history.state, timelineChapter: index }, '');
  sections.forEach((section, i) => {
    section.classList.toggle('is-current', i === index);
    section.inert = i !== index;
    section.setAttribute('aria-hidden', String(i !== index));
    if (i === index) buttons[i].setAttribute('aria-current', 'step');
    else buttons[i].removeAttribute('aria-current');
  });
  previous.disabled = index === 0 && target === 0;
  next.disabled = index === last && target === last;
  document.querySelector('.timeline-counter').textContent = `${chapters[index].rank} ♠ / ${chapters.at(-1).rank} ♠`;
  artwork.setAttribute('aria-label', `Scatter the illustration for ${chapters[index].label} and watch it return`);
  clearTimeout(announcement);
  announcement = setTimeout(() => {
    document.querySelector('.timeline-announcement').textContent = `Chapter ${index + 1} of ${chapters.length}. ${chapters[index].title} ${chapters[index].text}`;
  }, 240);
}

function paint(now = performance.now()) {
  frame = 0;
  if (document.hidden || !canvasVisible) return;
  // Time-based easing feels the same on 60Hz and high-refresh displays.
  const elapsed = lastFrame ? Math.min(50, now - lastFrame) : 16.7;
  lastFrame = now;
  // Read the preference during paint too: some browser media emulators update
  // matches before delivering the change event.
  const disabled = String(motion.matches);
  if (artwork.getAttribute('aria-disabled') !== disabled) artwork.setAttribute('aria-disabled', disabled);
  if (motion.matches) { current = target; transition = null; }
  else if (transition) {
    transition.start ??= now;
    const t = clamp((now - transition.start) / transition.duration, 0, 1);
    // A single gentle ease avoids the stop/rush/stop of a cubic ease layered
    // over the particle engine's own release and assembly curves.
    const eased = t * t * (3 - 2 * t);
    current = transition.from + (target - transition.from) * eased;
    if (t === 1) { current = target; transition = null; }
  } else current += (target - current) * (1 - Math.exp(-elapsed / 45));
  if (Math.abs(target - current) < 0.001) current = target;
  const destination = horizon.draw(current / last, now, motion.matches);
  const particlesMoving = particles.draw(current, motion.matches, now, destination);
  world.style.setProperty('--travel', `${current * 110}px`);
  viewport.classList.toggle('is-arriving', current > last - 0.5);
  progressBar.style.transform = `scaleX(${current / last})`;
  select(Math.round(current));
  const caption = clamp((0.5 - Math.abs(current - Math.round(current))) / 0.28, 0, 1);
  sections[active].style.opacity = motion.matches ? 1 : caption * caption * (3 - 2 * caption);
  previous.disabled = target <= 0;
  next.disabled = target >= last;
  if (current !== target || particlesMoving) frame = requestAnimationFrame(paint);
  else lastFrame = 0;
}

function schedule() {
  if (!frame && !document.hidden && canvasVisible) frame = requestAnimationFrame(paint);
}

function pause() {
  cancelAnimationFrame(frame); frame = 0; lastFrame = 0; touch = null;
  particles.resetInteraction();
  // Resume from the visible formation instead of rushing the remainder in a
  // few frames after Safari returns from another tab or its back/forward cache.
  if (transition) transition = {
    from: current, start: null, duration: clamp(Math.abs(target - current) * 1150, 450, 1600),
  };
}

function goTo(index, scrub = false) {
  target = clamp(index, 0, last);
  transition = scrub || motion.matches || target === current ? null : {
    from: current, start: null, duration: clamp(Math.abs(target - current) * 1150, 650, 1600),
  };
  schedule();
}

// Some touch browsers swallow the first compatibility click after a captured
// swipe. Activate a real tap on pointerup, and ignore its duplicate click.
function activate(button, action) {
  let start, lastTouch = -Infinity;
  button.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  button.addEventListener('pointercancel', () => { start = null; });
  button.addEventListener('pointerup', event => {
    if (event.pointerType !== 'touch' || start?.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    start = null;
    if (distance > 8 || button.disabled) return;
    lastTouch = performance.now();
    action(event);
  });
  button.addEventListener('click', event => {
    if (event.detail && performance.now() - lastTouch < 650) return;
    action(event);
  });
}
buttons.forEach((button, index) => activate(button, () => goTo(index)));
activate(previous, () => goTo(Math.round(target) - 1));
activate(next, () => goTo(Math.round(target) + 1));
activate(artwork, event => {
  if (motion.matches || performance.now() < suppressArtClickUntil) return;
  const positioned = event.detail || event.pointerType === 'touch';
  particles.disperse(positioned ? event.clientX : undefined, positioned ? event.clientY : undefined);
  schedule();
});

viewport.addEventListener('wheel', event => {
  // Leave browser zoom gestures alone; only vertical movement drives the story.
  if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  const pixels = event.deltaY * (event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? innerHeight : 1);
  if (!pixels) return;
  const now = performance.now(), direction = Math.sign(pixels);
  // A trackpad's trailing wheel events belong to the same gesture. A new
  // gesture (or reversal) selects exactly one chapter, never a partial page.
  if (now - wheelGesture.last > 320 || direction !== wheelGesture.direction) {
    wheelGesture.distance = 0;
    wheelGesture.claimed = direction === wheelGesture.direction && Boolean(transition);
  }
  wheelGesture.last = now; wheelGesture.direction = direction;
  wheelGesture.distance += Math.abs(pixels);
  if (!wheelGesture.claimed && wheelGesture.distance >= 22) {
    wheelGesture.claimed = true;
    goTo(Math.round(target) + direction);
  }
}, { passive: false });

viewport.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || (event.target.closest('button, a') && !event.target.closest('.timeline-artwork'))) return;
  if (touch) {
    if (viewport.hasPointerCapture(touch.id)) viewport.releasePointerCapture(touch.id);
    touch = null;
    goTo(Math.round(target));
    return;
  }
  touch = { id: event.pointerId, y: event.clientY, startY: event.clientY, moved: false, chapter: Math.round(target) };
});
viewport.addEventListener('pointermove', event => {
  if (event.pointerType !== 'touch' && !motion.matches) {
    particles.setPointer(event.clientX, event.clientY);
    schedule();
  }
  if (!touch || touch.id !== event.pointerId) return;
  if (!touch.moved) {
    if (Math.abs(event.clientY - touch.startY) < 8) return;
    touch.moved = true;
    viewport.setPointerCapture(event.pointerId);
  }
  touch.y = event.clientY;
});
const endTouch = event => {
  if (touch?.id !== event.pointerId) return;
  const moved = touch.moved;
  const distance = touch.startY - touch.y;
  const chapter = touch.chapter;
  touch = null;
  // Pointer capture releases automatically after pointerup/pointercancel.
  // Releasing it inside pointerup can suppress the next tap in Chromium.
  if (moved) {
    suppressArtClickUntil = performance.now() + 450;
    if (event.type !== 'pointercancel' && Math.abs(distance) >= 28) goTo(chapter + Math.sign(distance));
  }
};
viewport.addEventListener('pointerup', endTouch);
viewport.addEventListener('pointercancel', endTouch);
viewport.addEventListener('pointerleave', () => { particles.clearPointer(); schedule(); });

window.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const direction = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 }[event.key];
  if (direction) { event.preventDefault(); goTo(Math.round(target) + direction); }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault(); goTo(event.key === 'Home' ? 0 : last);
  }
  if (event.key === ' ' && !event.target.closest('button, a')) {
    event.preventDefault(); goTo(Math.round(target) + (event.shiftKey ? -1 : 1));
  }
});
window.addEventListener('resize', () => { particles.resize(); horizon.resize(); schedule(); });
const visibility = new IntersectionObserver(([entry]) => {
  canvasVisible = entry.isIntersecting;
  if (!canvasVisible) pause();
  else schedule();
});
visibility.observe(artwork);
function updateMotion() {
  artwork.setAttribute('aria-disabled', String(motion.matches));
  particles.resetInteraction(); goTo(Math.round(target));
}
motion.addEventListener('change', updateMotion);
artwork.setAttribute('aria-disabled', String(motion.matches));
document.addEventListener('visibilitychange', () => {
  pause();
  if (!document.hidden) schedule();
});
window.addEventListener('pagehide', () => {
  pause();
  clearTimeout(announcement);
});
window.addEventListener('pageshow', schedule);
paint();
