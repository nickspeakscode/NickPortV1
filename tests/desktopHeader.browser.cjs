const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  await fs.mkdir('test-results/desktop-header', { recursive: true });
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
      const errors = [];
      page.on('pageerror', error => { if (error.message !== 'Transition was skipped') errors.push(error.message); });
      await page.goto('http://127.0.0.1:5173/');
      await page.waitForTimeout(3800);
      const header = page.locator('.site-header');
      const expanded = await header.evaluate(el => el.getBoundingClientRect().height);
      const mainTop = await page.locator('main').evaluate(el => el.getBoundingClientRect().top + scrollY);
      await page.screenshot({ path: `test-results/desktop-header/${engine.name()}-expanded.png` });
      await page.evaluate(() => scrollTo({ top: 400, behavior: 'instant' }));
      await page.waitForFunction(() => document.querySelector('.site-header').classList.contains('is-compact'));
      await page.waitForTimeout(450);
      const compact = await header.evaluate(el => el.getBoundingClientRect().height);
      assert.ok(compact < expanded);
      assert.ok(Math.abs(await page.locator('main').evaluate(el => el.getBoundingClientRect().top + scrollY) - mainTop) < 1, 'content must not shift');
      assert.equal(await page.evaluate(() => scrollY), 400);
      assert.equal(await header.evaluate(el => el.getBoundingClientRect().top), 0);
      await page.screenshot({ path: `test-results/desktop-header/${engine.name()}-compact.png` });
      await page.evaluate(() => scrollTo({ top: 396, behavior: 'instant' }));
      await page.waitForTimeout(100);
      assert.ok(await header.evaluate(el => el.classList.contains('is-compact')), 'tiny scroll reversals should not flicker');
      await page.evaluate(() => scrollTo({ top: 350, behavior: 'instant' }));
      await page.waitForFunction(() => !document.querySelector('.site-header').classList.contains('is-compact'));
      await page.waitForTimeout(450);
      assert.equal(await header.evaluate(el => el.getBoundingClientRect().height), expanded);
      await page.evaluate(() => scrollTo({ top: 480, behavior: 'instant' }));
      await page.waitForFunction(() => document.querySelector('.site-header').classList.contains('is-compact'));
      await page.getByRole('link', { name: 'About', exact: true }).focus().catch(() => page.locator('.site-header nav a').nth(1).evaluate(el => el.focus()));
      await page.waitForFunction(() => !document.querySelector('.site-header').classList.contains('is-compact'));
      await page.setViewportSize({ width: 1024, height: 800 });
      await page.evaluate(() => document.activeElement.blur());
      await page.waitForTimeout(450);
      const medium = await header.evaluate(el => el.getBoundingClientRect().height);
      await page.evaluate(() => scrollTo({ top: 600, behavior: 'instant' }));
      await page.waitForFunction(() => document.querySelector('.site-header').classList.contains('is-compact'));
      await page.waitForTimeout(450);
      assert.ok(await header.evaluate(el => el.getBoundingClientRect().height) < medium);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(450);
      const mobile = await header.evaluate(el => el.getBoundingClientRect().height);
      await page.evaluate(() => scrollTo({ top: 800, behavior: 'instant' }));
      await page.waitForTimeout(450);
      assert.equal(await header.evaluate(el => el.getBoundingClientRect().height), mobile);
      assert.ok(!await header.evaluate(el => el.classList.contains('is-compact')));
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('button', { name: 'Close menu' }).click();
      await page.waitForFunction(() => !document.querySelector('#mobileMenu').open);
      await page.setViewportSize({ width: 1440, height: 600 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const route of ['/writing/', '/library/', '/notes/']) {
        await page.goto('http://127.0.0.1:5173' + route);
        await page.waitForTimeout(5500);
        assert.equal(await page.locator('.desktop-header-space').count(), 1);
        // Give short/empty CMS pages room to exercise the shared scroll component.
        await page.evaluate(() => { const space = document.createElement('div'); space.style.height = '1000px'; document.querySelector('main').append(space); scrollTo({ top: 200, behavior: 'instant' }); });
        await page.waitForFunction(() => document.querySelector('.site-header').classList.contains('is-compact'));
        assert.equal(await header.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.waitForFunction(() => !document.querySelector('.site-header').classList.contains('is-compact'));
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine.name()}: ${expanded}px to ${compact}px; direction, jitter, stable layout, focus, 1024px, mobile unchanged, interior routes, reduced motion`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exit(1); });
