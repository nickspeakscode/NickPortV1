const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
(async () => {
  await fs.mkdir('test-results/mobile-nav', { recursive: true });
  for (const engine of [chromium, webkit]) {
    if (process.env.TEST_ENGINE && process.env.TEST_ENGINE !== engine.name()) continue;
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ ...devices['iPhone 13'] });
      const errors = [];
      page.on('pageerror', error => {
        // A superseded native cross-document transition is browser cancellation,
        // not an application exception. Keep it visible in the test output.
        if (error.message === 'Transition was skipped') console.log('NOTE native page transition cancelled');
        else errors.push(error.stack || error.message);
      });
      for (const route of ['/', '/writing/', '/library/', '/notes/']) {
        await page.goto(origin + route);
        await page.waitForTimeout(5500); // Allow the existing CMS fetch/rerender to settle.
        const toggle = page.getByRole('button', { name: 'Open menu' });
        await toggle.waitFor();
        assert.equal(await page.locator('.header-left nav').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await toggle.tap();
        await page.locator('#mobileMenu').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#mobileMenu nav a').count(), 5);
        assert.equal(await page.locator('#mobileMenu .social-icons a').count(), 5);
        assert.ok(await page.evaluate(() => document.querySelector('#mobileMenu').contains(document.activeElement)));
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press('Tab');
          assert.ok(await page.evaluate(() => document.querySelector('#mobileMenu').contains(document.activeElement)));
        }
        if (route === '/') await page.screenshot({ path: `test-results/mobile-nav/${engine.name()}-open.png` });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#mobileMenu').open);
        assert.equal(await page.locator('#mobileMenu').evaluate(el => el.open), false);
        assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
        if (route === '/') await page.screenshot({ path: `test-results/mobile-nav/${engine.name()}-closed.png` });
        console.log(`PASS ${engine.name()} mobile ${route}`);
      }
      await page.goto(origin);
      await page.waitForTimeout(3500);
      await page.evaluate(() => scrollTo({ top: 450, behavior: 'instant' }));
      const oldScroll = await page.evaluate(() => scrollY);
      // Tap the visible sticky trigger directly: locator.tap() scrollIntoView
      // can move a sticky header to its original document position.
      const triggerBox = await page.getByRole('button', { name: 'Open menu' }).boundingBox();
      await page.touchscreen.tap(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
      await page.waitForTimeout(400);
      await page.mouse.click(5, 300);
      await page.waitForFunction(() => !document.querySelector('#mobileMenu').open);
      assert.equal(await page.locator('#mobileMenu').evaluate(el => el.open), false);
      assert.equal(await page.evaluate(() => scrollY), oldScroll);
      await page.getByRole('button', { name: 'Open menu' }).tap();
      await page.getByRole('link', { name: 'About', exact: true }).tap();
      await page.waitForTimeout(1200);
      assert.ok(page.url().endsWith('#about'));
      assert.ok(await page.locator('#about').evaluate(el => el.getBoundingClientRect().top >= document.querySelector('.site-header').getBoundingClientRect().bottom));
      await page.getByRole('button', { name: 'Open menu' }).tap();
      await page.getByRole('link', { name: 'Library', exact: true }).tap();
      await page.waitForURL('**/library/');
      await page.waitForTimeout(5500);
      await page.getByRole('button', { name: 'Open menu' }).tap();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.waitForFunction(() => !document.querySelector('#mobileMenu').open && document.querySelector('.header-left nav'));
      assert.equal(await page.locator('#mobileMenu').evaluate(el => el.open), false);
      assert.equal(await page.locator('.header-left nav a').count(), 5);
      assert.equal(await page.locator('.site-header > .social-icons a').count(), 5);
      assert.notEqual(await page.evaluate(() => document.body.style.position), 'fixed');
      for (const route of ['/', '/writing/', '/library/', '/notes/']) {
        await page.goto(origin + route);
        await page.locator('.header-left nav').waitFor();
        await page.waitForTimeout(700); // Let native cross-document view transitions complete.
        assert.equal(await page.getByRole('button', { name: 'Open menu' }).isVisible(), false);
        assert.equal(await page.locator('.header-left nav a').count(), 5);
      }
      await page.setViewportSize({ width: 320, height: 568 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Open menu' }).tap();
      assert.equal(await page.locator('#mobileMenu').evaluate(el => el.getAnimations().length), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: 'Close menu' }).tap();
      assert.equal(await page.locator('#mobileMenu').evaluate(el => el.open), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine.name()} links, backdrop, scroll restoration, resize, desktop routes, reduced motion, 320px`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exit(1); });
