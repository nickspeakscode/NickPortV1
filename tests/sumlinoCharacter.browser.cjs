const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const output = process.env.PREVIEW_OUTPUT || 'output/playwright';
  await fs.mkdir(output, { recursive: true });
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const mobile of [false, true]) {
        const context = await browser.newContext({
          viewport: mobile ? { width: 320, height: 640 } : { width: 1440, height: 1000 },
          isMobile: mobile, hasTouch: mobile,
        });
        context.setDefaultTimeout(15000);
        await context.route('https://sumlino.app/', route => route.fulfill({ body: '<title>Sumlino destination</title>' }));
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:5173/#about');
        const trigger = page.getByRole('link', { name: 'Sumlino (opens in a new tab)', exact: true });
        const preview = page.locator('.sumlino-preview');
        const link = page.getByRole('link', { name: 'Visit the Sumlino website (opens in a new tab)', exact: true });
        const focusTrigger = async () => {
          await trigger.evaluate(el => el.blur());
          await page.keyboard.press('Tab');
          await trigger.focus();
          await preview.waitFor({ state: 'visible' });
        };
        await trigger.scrollIntoViewIfNeeded();
        await page.waitForTimeout(900);
        const originalWidth = (await trigger.boundingBox()).width;
        assert.equal(await trigger.innerText(), 'Sumlino', 'brand is visible without interaction');
        assert.equal(await page.locator('.redacted-label').count(), 0);
        assert.equal(await trigger.getAttribute('href'), 'https://sumlino.app/');
        const directPopup = context.waitForEvent('page');
        if (mobile) await trigger.tap(); else await trigger.click();
        const destination = await directPopup;
        await destination.waitForURL('https://sumlino.app/');
        await destination.close();
        assert.equal(await preview.isVisible(), false, 'one tap or click navigates directly, without an extra reveal step');
        if (mobile) await focusTrigger();
        else { await page.mouse.move(0, 0); await trigger.hover(); }
        await page.waitForTimeout(350);
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        assert.ok(Math.abs((await trigger.boundingBox()).width - originalWidth) < 1, 'preview preserves paragraph layout');
        await page.locator('.sumlino-character').evaluate(img => img.decode());
        assert.match(await page.locator('.sumlino-character').evaluate(img => img.currentSrc), /\.gif$/);
        const box = await preview.boundingBox();
        const size = page.viewportSize();
        assert.ok(box.x >= 15 && box.x + box.width <= size.width - 15, 'fits screen horizontally');
        assert.ok(box.y >= 0 && box.y + box.height <= size.height, 'fits screen vertically');
        await page.waitForTimeout(400);
        assert.deepEqual(await preview.boundingBox(), box, 'preview stays anchored');
        await page.screenshot({ path: path.join(output, `sumlino-signature-${engine.name()}-${mobile ? 'phone' : 'desktop'}.png`) });

        if (mobile) {
          await page.touchscreen.tap(5, 600);
          assert.equal(await preview.isVisible(), false, 'outside tap closes');
        } else {
          await link.hover();
          await page.waitForTimeout(300);
          assert.equal(await preview.isVisible(), true, 'pointer can cross to preview');
          await page.mouse.move(0, 0);
          await page.waitForTimeout(400);
          assert.equal(await preview.isVisible(), false, 'leaving closes preview');
          await trigger.hover();
          await page.keyboard.press('Escape');
          assert.equal(await preview.isVisible(), false, 'Escape closes even while hovered');
        }

        await focusTrigger();
        await page.keyboard.press('Tab');
        assert.equal(await link.evaluate(el => el === document.activeElement), true, 'keyboard can enter the preview');
        await page.keyboard.press('Escape');
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Escape restores focus');
        await focusTrigger();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => document.querySelector('.sumlino-character').currentSrc.endsWith('-still.png'), null, { polling: 100 });
        assert.equal(await link.evaluate(el => getComputedStyle(el).animationName), 'none');
        const popupReady = context.waitForEvent('page');
        await link.press('Enter');
        const popup = await popupReady;
        await popup.waitForURL('https://sumlino.app/');
        await popup.close();
        assert.equal(await preview.isVisible(), false);

        await focusTrigger();
        await page.getByRole('button', { name: 'Close Sumlino preview' }).click();
        assert.equal(await preview.isVisible(), false);
        await focusTrigger();
        await page.evaluate(() => scrollBy(0, 30));
        await page.waitForTimeout(150);
        assert.equal(await preview.isVisible(), true, 'a small settling scroll keeps the preview open');
        await page.waitForTimeout(700);
        await page.evaluate(() => scrollBy(0, 240));
        await page.waitForTimeout(150);
        assert.equal(await preview.isVisible(), false, 'a real scroll away dismisses instead of trailing the page');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(errors, []);
        console.log(`PASS ${engine.name()} ${mobile ? 'phone' : 'desktop'}: visible Sumlino link, direct navigation, character preview, focus, dismissal, reduced motion, no overflow/errors`);
        await context.close();
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exit(1); });
