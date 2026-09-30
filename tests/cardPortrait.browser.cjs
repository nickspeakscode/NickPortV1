// Run against local Vite; PLAYWRIGHT_MODULE may point to an external installation.
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const output = path.resolve('test-results/card-reveal');

async function verify(engine, mobile) {
  const name = `${engine.name()}-${mobile ? 'mobile' : 'desktop'}`;
  const browser = await engine.launch({ headless: true });
  const page = await browser.newPage(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  const proof = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.bringToFront();
    await page.waitForTimeout(3500);
    await page.locator('.portrait-shell[data-state="idle"]').waitFor();
    assert.match(await page.locator('.hero-copy p').innerText(), /financial planning and analysis for HVAC businesses/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const seen = new Set();
    for (let attempt = 0; attempt < 5 && seen.size < 3; attempt++) {
      const before = await page.locator('#portraitSource').getAttribute('src');
      // No cooldown: every click/tap after the preceding settle must start now.
      if (mobile) await page.locator('.portrait-shell').tap();
      else await page.locator('.portrait-shell').click();
      await page.locator('.portrait-shell[data-state="shuffling"]').waitFor();
      const variation = await page.locator('.portrait-shell').getAttribute('data-shuffle');
      seen.add(variation);
      const next = await page.evaluate(() => {
        const shell = document.querySelector('.portrait-shell');
        window.deckAnimations = shell.getAnimations({ subtree: true });
        deckAnimations.forEach(a => { a.pause(); a.currentTime = 0; });
        return document.querySelector('.joker-photo-frame img:last-child').getAttribute('src');
      });
      assert.notEqual(next, before);
      const checkpoints = [];
      for (const progress of [0, 0.2, 0.78, 0.875, 0.90, 0.925, 0.95, 0.995]) {
        const sample = await page.evaluate(async progress => {
          deckAnimations.forEach(a => { a.currentTime = progress * 3000; });
          await new Promise(requestAnimationFrame);
          const frame = document.querySelector('.joker-photo-frame');
          const frameOpacity = Number(getComputedStyle(frame).opacity);
          const layers = [...frame.querySelectorAll('img')].map(node => ({ src: node.getAttribute('src'), opacity: Number(getComputedStyle(node).opacity) }));
          const facing = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.portrait-card--photo')).transform).m33;
          return { progress, frameOpacity, layers, facing };
        }, progress);
        checkpoints.push(sample);
        const incoming = sample.layers.at(-1);
        if (progress === 0) assert.equal(incoming.opacity, 0);
        if (progress >= 0.2 && progress <= 0.78) {
          assert.equal(incoming.opacity, 0, `${name} ${variation}: early incoming layer`);
          assert.equal(sample.frameOpacity, 0, `${name} ${variation}: photo leaks through card back`);
        }
        if (sample.facing < 0) assert.equal(sample.frameOpacity, 0);
        if (progress >= 0.925) {
          assert.ok(sample.facing > 0);
          assert.equal(sample.frameOpacity, 1);
          assert.equal(incoming.opacity, 1, `${name} ${variation}: final flip shows old photo`);
        }
        if (progress === 0.2 || progress === 0.95) await page.screenshot({ path: path.join(output, `${name}-${variation}-${progress}.png`), timeout: 15000 });
      }
      // Replay the exact same animations on the real clock. No timer controls
      // the photo; inspect the visible layer every rendered frame.
      await page.evaluate(() => {
        const shell = document.querySelector('.portrait-shell');
        window.revealTrace = [];
        deckAnimations.forEach(a => { a.currentTime = 0; a.play(); });
        const start = document.timeline.currentTime;
        deckAnimations.forEach(a => { a.startTime = start; });
        function sample() {
          const frame = document.querySelector('.joker-photo-frame');
          const node = frame.querySelector('img:last-child');
          const facing = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.portrait-card--photo')).transform).m33;
          revealTrace.push({ time: document.timeline.currentTime - start, state: shell.dataset.state, facing, src: node.getAttribute('src'), opacity: Number(getComputedStyle(frame).opacity) * Number(getComputedStyle(node).opacity) });
          if (shell.dataset.state === 'shuffling') requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      // Input during the active trick cannot restart it or queue another trick.
      await page.locator('.portrait-shell').press('Enter');
      await page.locator('.portrait-shell[data-state="idle"]').waitFor();
      assert.equal(await page.locator('#portraitSource').getAttribute('src'), next);
      assert.equal(await page.locator('.joker-photo-frame img').count(), 1);
      const trace = await page.evaluate(() => revealTrace);
      await fs.writeFile(path.join(output, `${name}-${variation}-trace.json`), JSON.stringify({ checkpoints, trace }, null, 2));
      // Slow WebKit rendering can skip the entire final quarter-second.
      // Check photo and card together on every delivered frame; precise
      // pre-settle times are independently covered by the checkpoints above.
      const faceUpFrames = trace.filter(s => s.time > 2400 && s.facing > 0.1);
      assert.ok(faceUpFrames.length > 0);
      assert.ok(faceUpFrames.every(s => s.opacity === 1 && s.src === next), `${name}: final face-up card must already show the new photo`);
      assert.ok(trace.filter(s => s.time >= 200 && s.time < 2400).every(s => s.opacity === 0));
      const settled = await page.locator('.joker-photo-frame').screenshot();
      await page.waitForTimeout(1100);
      const later = await page.locator('.joker-photo-frame').screenshot();
      assert.ok(settled.equals(later), `${name} ${variation}: portrait pixels changed after settle`);
      await fs.writeFile(path.join(output, `${name}-${variation}-settled.png`), settled);
      assert.equal(await page.locator('.portrait-shell').getAttribute('data-state'), 'idle', 'No queued replay');
      proof.push({ variation, before, next, checkpoints, trace });
      console.log(`PASS ${name} ${variation}: hidden at 20%, new photo on final flip, identical pixels 1.1s after settle`);
    }
    assert.equal(seen.size, 3);
    // Immediate successive keyboard activation, with no quiet period.
    await page.locator('.portrait-shell').press('Space');
    await page.locator('.portrait-shell[data-state="shuffling"]').waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.portrait-shell').dataset.state === 'idle');
    assert.equal(await page.locator('#portraitSource').getAttribute('src'), '/nick-pixel-source.jpg');
    assert.equal(await page.locator('.joker-photo-frame img').count(), 1);
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, `${name}.json`), JSON.stringify({ name, proof, errors }, null, 2));
    console.log(`PASS ${name}: all techniques, click/tap/keyboard without cooldown, cancellation, no late swap`);
  } finally { await browser.close(); }
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  // Run one browser at a time to avoid Windows WebKit frame throttling when
  // several headless windows compete for foreground rendering.
  for (const [engine, mobile] of [[chromium, false], [chromium, true], [webkit, false], [webkit, true]]) {
    if (process.env.TEST_BROWSER && process.env.TEST_BROWSER !== `${engine.name()}-${mobile ? 'mobile' : 'desktop'}`) continue;
    await verify(engine, mobile);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
