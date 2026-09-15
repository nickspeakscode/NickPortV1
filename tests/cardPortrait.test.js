import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/lib/cardPortrait.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/m, '').replace('export function', 'function');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function setup({ failed = [], reduced = false, audioReady = true } = {}) {
  let observer;
  const running = [];
  const audio = {
    ready: audioReady, plays: [],
    unlock() { this.ready = true; },
    play(...args) { this.plays.push(args); },
    stop() {},
    canPlay() { return this.ready; },
  };
  class Element {
    listeners = {};
    dataset = {};
    children = [];
    classList = { add() {} };
    style = { removeProperty(key) { delete this[key]; } };
    addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
    emit(type, event = {}) { this.listeners[type]?.forEach(handler => handler(event)); }
    removeAttribute(key) { delete this[key]; }
    append(node) { node.parentElement = this; this.children.push(node); }
    remove() {
      if (!this.parentElement) return;
      const parent = this.parentElement;
      parent.children.splice(parent.children.indexOf(this), 1);
      this.parentElement = null;
    }
    replaceWith(node) {
      const parent = this.parentElement;
      parent.children[parent.children.indexOf(this)] = node;
      node.parentElement = parent;
      this.parentElement = null;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 300 }; }
    animate(frames, options) {
      let resolve, reject;
      const animation = { target: this, frames, options, finished: new Promise((yes, no) => { resolve = yes; reject = no; }) };
      animation.finish = resolve;
      animation.cancel = () => { animation.cancelled = true; reject(new Error('cancelled')); };
      running.push(animation);
      return animation;
    }
  }
  const frame = new Element();
  const image = new Element();
  image.src = '/nick-pixel-source.jpg';
  frame.append(image);
  const shell = new Element();
  const hero = new Element();
  const cards = Array.from({ length: 5 }, () => new Element());
  shell.querySelectorAll = () => cards;
  const motion = new Element();
  motion.matches = reduced;
  const context = vm.createContext({
    window: { matchMedia: () => motion },
    document: { hidden: false, timeline: { currentTime: 1234 }, addEventListener() {} },
    createCardAudio: () => audio,
    Image: class extends Element {
      decode() { return failed.includes(this.src) ? Promise.reject() : Promise.resolve(); }
    },
    IntersectionObserver: class {
      constructor(callback) { observer = callback; }
      observe() {}
    },
  });
  vm.runInContext(source, context);
  const api = context.createCardPortrait({ hero, shell, image });
  await flush();
  image.emit('load');
  return {
    api, shell, hero, frame, motion, running, cards, audio,
    visible(value) { observer([{ isIntersecting: value }]); },
    async finish() { running.filter(a => !a.cancelled).forEach(a => a.finish()); await flush(); },
  };
}

test('decoded image is staged invisibly and completion retains that same node', async () => {
  const h = await setup();
  assert.equal(h.frame.children.length, 2);
  const incoming = h.frame.children[1];
  assert.equal(incoming.style.opacity, '0');
  assert.equal(h.frame.children[0].src, '/nick-pixel-source.jpg');
  // The photo and mask share exactly the same start time as all five cards.
  assert.ok(h.running.every(a => a.startTime === 1234 && a.options.duration === 3000));
  h.running.filter(a => a.target !== h.cards[4]).forEach(a => a.finish());
  await flush();
  assert.equal(h.shell.dataset.state, 'shuffling');
  await h.finish();
  assert.equal(h.shell.dataset.state, 'idle');
  assert.equal(h.frame.children.length, 1);
  assert.equal(h.frame.children[0], incoming);
  assert.equal(incoming.style.opacity, undefined);
});

test('silent intro and locked hover cannot consume the first sound-enabled click', async () => {
  const h = await setup({ audioReady: false });
  assert.equal(h.audio.plays.length, 0);
  await h.finish();
  const count = h.running.length;
  h.hero.emit('pointerenter', { pointerType: 'mouse' });
  h.shell.emit('pointerenter', { pointerType: 'mouse' });
  h.api.disturb(100, 150);
  assert.equal(h.running.length, count);
  h.audio.unlock(); // Trusted document capture handler runs before click.
  h.shell.emit('click', { pointerType: 'mouse' });
  assert.equal(h.shell.dataset.state, 'shuffling');
  assert.equal(h.audio.plays.length, 1);
  await h.finish();
  h.hero.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(h.audio.plays.length, 2);
});

test('all interactions replay immediately after settle, never during an active trick', async () => {
  const triggers = [
    h => h.api.disturb(100, 150),
    h => h.api.scatterFrom(),
    h => h.hero.emit('pointerenter', { pointerType: 'mouse' }),
    h => h.shell.emit('click', { pointerType: 'mouse', detail: 1 }),
    h => h.shell.emit('click', { pointerType: 'touch', detail: 1 }),
    h => h.shell.emit('click', { detail: 0 }),
  ];
  for (const trigger of triggers) {
    const h = await setup();
    const count = h.running.length;
    trigger(h);
    assert.equal(h.running.length, count);
    await h.finish();
    trigger(h);
    assert.equal(h.shell.dataset.state, 'shuffling');
    assert.equal(h.running.length, count * 2);
    await h.finish();
    await flush();
    assert.equal(h.shell.dataset.state, 'idle');
  }
});

test('touch hover is ignored but its native click starts exactly one trick', async () => {
  const h = await setup();
  await h.finish();
  const count = h.running.length;
  h.hero.emit('pointerenter', { pointerType: 'touch' });
  h.shell.emit('pointermove', { pointerType: 'touch' });
  assert.equal(h.running.length, count);
  h.shell.emit('click', { pointerType: 'mouse', detail: 1 }); // WebKit compatibility click
  h.shell.emit('click', { pointerType: 'touch', detail: 1 });
  assert.equal(h.running.length, count * 2);
});

test('offscreen cancellation removes the staged image; replay needs no quiet time', async () => {
  const h = await setup();
  const staged = h.frame.children[1];
  h.visible(false);
  await flush();
  assert.equal(staged.parentElement, null);
  assert.equal(h.frame.children.length, 1);
  assert.equal(h.frame.children[0].src, '/nick-pixel-source.jpg');
  h.visible(true);
  h.api.scatterFrom();
  assert.equal(h.shell.dataset.state, 'shuffling');
  assert.equal(h.frame.children[1], staged);
  await h.finish();
  assert.equal(h.frame.children[0].src, '/nick-waterfall-summer.jpg');
});

test('pause cancels and reduced motion restores the original without staged nodes', async () => {
  const h = await setup();
  await h.finish();
  h.api.scatterFrom();
  h.api.pause();
  await flush();
  assert.equal(h.frame.children[0].src, '/nick-waterfall-summer.jpg');
  h.motion.matches = true;
  h.motion.emit('change');
  h.api.resume();
  h.api.scatterFrom();
  assert.equal(h.frame.children[0].src, '/nick-pixel-source.jpg');
  assert.equal(h.frame.children.length, 1);
  assert.equal(h.shell.dataset.state, 'idle');
});

test('failed photos are skipped and the curated cycle includes the business portrait before wrapping', async () => {
  const h = await setup({ failed: ['/nick-waterfall-summer.jpg'] });
  for (const expected of ['/nick-mirror.jpg', '/nick-snow.jpg', '/nick-waterfall-autumn.jpg', '/nick-business-portrait.jpg', '/nick-pixel-source.jpg']) {
    await h.finish();
    assert.equal(h.frame.children[0].src, expected);
    h.api.scatterFrom();
  }
});

test('cancelling a wraparound reveal cannot leave the reduced-motion original transparent', async () => {
  const h = await setup();
  for (let index = 0; index < 5; index++) {
    await h.finish();
    h.api.scatterFrom();
  }
  assert.equal(h.frame.children[1].src, '/nick-pixel-source.jpg');
  h.motion.matches = true;
  h.motion.emit('change');
  await flush();
  assert.equal(h.frame.children.length, 1);
  assert.equal(h.frame.children[0].src, '/nick-pixel-source.jpg');
  assert.equal(h.frame.children[0].style.opacity, undefined);
});
