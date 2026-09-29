const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

const block = text => [{ _type: 'block', style: 'normal', markDefs: [], children: [{ _type: 'span', text, marks: [] }] }];
const resources = [
  { title: 'Decision Notes', slug: 'decision-notes', resourceType: 'Book', authorCreator: 'Test Author', status: 'Completed', progress: 100, rating: 4.5, category: 'Finance', description: 'A resource description supplied by the CMS.', personalSummary: block('My saved thoughts from Sanity.'), keyTakeaways: ['A saved takeaway.'], startDate: '2026-01-01', finishDate: '2026-02-01', coverImage: 'https://cdn.sanity.io/images/vzrug3c0/production/test-cover.svg' },
  { title: '<Systems & Learning>', slug: 'systems', resourceType: 'Course', authorCreator: 'Test Creator', status: 'Currently Learning', progress: 35, rating: null, description: 'A course without a cover image.', personalSummary: [], keyTakeaways: [] },
  { title: 'CMA preparation', slug: 'cma', resourceType: 'Certification', status: 'Currently Learning', progress: 10, description: 'The featured study resource.', coverImage: 'https://cdn.sanity.io/images/vzrug3c0/production/test-certificate.svg', externalUrl: 'https://example.com/credential' },
  { title: 'My original book', slug: 'original', resourceType: 'Book', createdByMe: true, status: 'Published', progress: 100, description: 'An original book written by the portfolio owner.' },
  { title: 'A custom resource', slug: 'custom', resourceType: 'Other', customResourceType: 'Essay & Guide', description: 'A resource with a custom type managed in Sanity.', coverImage: 'https://cdn.sanity.io/images/vzrug3c0/production/broken-cover.jpg', externalUrl: 'javascript:alert(1)', personalSummary: [{ _type: 'block', style: 'normal', markDefs: [{ _key: 'unsafe', _type: 'link', href: 'javascript:alert(1)' }], children: [{ _type: 'span', text: 'Unsafe link stays readable.', marks: ['unsafe'] }] }] },
];

(async () => {
  for (const engine of [chromium, webkit]) {
    if (process.env.LIBRARY_ENGINE && process.env.LIBRARY_ENGINE !== engine.name()) continue;
    const browser = await engine.launch();
    try {
      for (const mobile of [false, true]) {
        if (process.env.LIBRARY_VIEW && process.env.LIBRARY_VIEW !== (mobile ? 'phone' : 'desktop')) continue;
        const context = await browser.newContext({ viewport: mobile ? { width: 320, height: 740 } : { width: 1440, height: 950 }, isMobile: mobile, hasTouch: mobile });
        context.setDefaultTimeout(15000);
        let delay = 0;
        let fail = false;
        await context.route('**/data/query/production?**', async route => {
          const url = new URL(route.request().url());
          const slug = JSON.parse(url.searchParams.get('$slug') || 'null');
          if (slug && delay) await new Promise(resolve => setTimeout(resolve, delay));
          if (slug && fail) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
          const result = slug ? {
            resource: resources.find(resource => resource.slug === slug) || null,
            notes: slug === 'decision-notes' ? [{ title: 'A related learning note', slug: 'related-note', body: block('A note.'), publishedAt: '2026-01-02' }] : [],
          } : resources;
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ result }) });
        });
        await context.route('**/test-cover.svg?**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#17394a"/><text x="24" y="60" fill="#5dffd0">Decision Notes</text></svg>' }));
        await context.route('**/test-certificate.svg?**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#dce7e4"/><text x="100" y="180" fill="#123747" font-size="36">Certification</text></svg>' }));
        await context.route('**/broken-cover.jpg?**', route => route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:5173/library/');
        const first = page.locator('.shelf-link[data-resource="decision-notes"]');
        const second = page.locator('.shelf-link[data-resource="systems"]');
        const reader = page.locator('.library-reader');
        await first.waitFor();
        await page.waitForTimeout(650);
        assert.equal(await page.locator('.shelf-link').count(), 4);
        assert.equal(await page.locator('.index-featured [data-resource="cma"]').count(), 1);
        assert.equal(await second.locator('.shelf-title').textContent(), '<Systems & Learning>');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const mine = page.locator('[data-filter="mine"]');
        await mine.click();
        assert.equal(await mine.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.shelf-link').count(), 1);
        assert.equal(await page.locator('.shelf-title').textContent(), 'My original book');
        assert.ok(page.url().endsWith('?shelf=mine'));
        await page.reload();
        await page.locator('.shelf-title').waitFor();
        assert.equal(await mine.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.shelf-link').count(), 1);
        await page.locator('.shelf-link').click();
        await page.waitForFunction(() => document.querySelector('.library-reader').open && !document.querySelector('.library-reader').classList.contains('is-opening'));
        assert.equal(await reader.locator('.resource-type-badge').textContent(), 'Book · My work');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => {
          const reader = document.querySelector('.library-reader');
          return !reader.open || Number(getComputedStyle(reader).opacity) < 1;
        }, null, { timeout: 700 });
        await page.waitForFunction(() => !document.querySelector('.library-reader').open, null, { timeout: 700 });
        await page.locator('[data-filter="type:Certification"]').click();
        assert.equal(await page.locator('.shelf-link').count(), 1);
        assert.equal(await page.locator('.shelf-title').textContent(), 'CMA preparation');
        await page.locator('.shelf-link').click();
        await page.waitForFunction(() => document.querySelector('.library-reader').open && !document.querySelector('.library-reader').classList.contains('is-opening'));
        assert.equal(await page.locator('#library-reader-title').textContent(), 'CMA preparation');
        assert.equal(await reader.locator('.resource-external').getAttribute('href'), 'https://example.com/credential');
        assert.ok((await reader.locator('.resource-external').textContent()).includes('View credential'));
        assert.equal(await reader.locator('.resource-detail-cover img').evaluate(image => getComputedStyle(image).objectFit), 'contain', 'landscape credentials are not cropped');
        await page.goBack();
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);
        await page.locator('[data-filter="mine"][aria-pressed="true"]').waitFor();
        assert.equal(await mine.getAttribute('aria-pressed'), 'true', 'history closes the reader and restores the previous filter');
        await page.locator('[data-filter="type:Certification"]').click();
        await page.locator('[data-filter="type:Essay & Guide"]').click();
        assert.equal(await page.locator('.shelf-link').count(), 1);
        assert.equal(await page.locator('.shelf-type').textContent(), 'Essay & Guide');
        await page.locator('.shelf-link').click();
        await page.waitForFunction(() => document.querySelector('.library-reader').open && !document.querySelector('.library-reader').classList.contains('is-opening'));
        assert.equal(await reader.locator('#library-reader-title').textContent(), 'A custom resource');
        await reader.locator('.resource-detail-cover.book-face-fallback').waitFor();
        assert.equal(await reader.locator('.resource-external, a[href^="javascript:"]').count(), 0);
        assert.ok((await reader.innerText()).includes('Unsafe link stays readable.'));
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);
        await page.goBack();
        assert.equal(await page.locator('[data-filter="type:Certification"]').getAttribute('aria-pressed'), 'true');
        await page.locator('[data-filter="type:Book"]').click();
        assert.equal(await page.locator('.shelf-link').count(), 2, 'books include both read and authored work');
        await page.goto('http://127.0.0.1:5173/library/?shelf=type:Missing');
        await page.getByText('Nothing in this collection yet.', { exact: false }).waitFor();
        assert.equal(await page.locator('.shelf-link').count(), 0);
        await page.locator('[data-filter="all"]').click();
        assert.equal(await page.locator('.shelf-link').count(), 4);
        assert.equal(await page.locator('.library-filter[aria-pressed="true"]').count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await first.scrollIntoViewIfNeeded();
        const initialScroll = await page.evaluate(() => scrollY);
        if (mobile) await first.tap(); else await first.click();
        try {
          await page.waitForFunction(() => document.querySelector('.library-reader').open && !document.querySelector('.library-reader').classList.contains('is-opening'));
        } catch (error) {
          console.log('Reader diagnostics', await page.evaluate(() => ({ url: location.href, reader: document.querySelector('.library-reader')?.outerHTML, focused: document.activeElement?.outerHTML, scrollY })));
          throw error;
        }
        await page.getByText('A related learning note', { exact: true }).waitFor();
        assert.equal(await page.locator('#library-reader-title').textContent(), 'Decision Notes');
        assert.ok((await reader.innerText()).includes('My saved thoughts from Sanity.'));
        assert.ok((await reader.innerText()).includes('A saved takeaway.'));
        assert.equal(await reader.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '100');
        assert.match(await page.locator('.reader-permalink').getAttribute('href'), /\/library\/decision-notes$/);
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        assert.equal(await reader.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        for (let tab = 0; tab < 9; tab++) {
          await page.keyboard.press('Tab');
          assert.equal(await reader.evaluate(el => el.contains(document.activeElement)), true, 'modal traps keyboard focus');
        }
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);
        assert.equal(await first.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        assert.ok(Math.abs(await page.evaluate(() => scrollY) - initialScroll) < 2);

        // A request completing after an interrupted opening must not replace the next selection.
        delay = 900;
        await first.click();
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);
        delay = 0;
        await second.click();
        await page.waitForTimeout(1200);
        assert.equal(await page.locator('#library-reader-title').textContent(), '<Systems & Learning>');
        assert.equal(await page.locator('.book-flight').count(), 0);
        assert.equal(await reader.locator('.resource-rating').count(), 0, 'unset ratings stay absent');
        await page.getByRole('button', { name: 'Return to shelf' }).click();
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);

        fail = true;
        await first.click();
        await page.locator('.reader-notice:not([hidden])').waitFor();
        assert.ok((await reader.innerText()).includes('My saved thoughts from Sanity.'));
        assert.ok((await reader.innerText()).includes('Related notes are unavailable'));
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);
        fail = false;
        // Related-note refreshes must not replace an already decoded cover.
        delay = 1100;
        await first.click();
        await reader.locator('.resource-detail-cover').evaluate(cover => { cover.dataset.retained = 'yes'; });
        await page.getByText('A related learning note', { exact: true }).waitFor();
        assert.equal(await reader.locator('.resource-detail-cover').getAttribute('data-retained'), 'yes');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);
        delay = 0;

        // Resizing finishes the motion without leaving an invisible cover or locked page.
        await second.click();
        await page.setViewportSize({ width: mobile ? 390 : 1024, height: 800 });
        await page.waitForFunction(() => !document.querySelector('.library-reader').classList.contains('is-opening'));
        assert.equal(await page.locator('.book-flight, .resource-detail-cover.is-in-flight').count(), 0);
        assert.equal(await reader.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        await page.getByRole('button', { name: 'Return to shelf' }).click();
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        await page.setViewportSize(mobile ? { width: 320, height: 740 } : { width: 1440, height: 950 });

        await page.emulateMedia({ reducedMotion: 'reduce' });
        await first.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.book-flight').count(), 0);
        assert.equal(await reader.evaluate(el => el.classList.contains('is-opening')), false);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.library-reader').open);

        await page.goto('http://127.0.0.1:5173/library/decision-notes');
        await page.getByRole('heading', { level: 1, name: 'Decision Notes' }).waitFor();
        assert.equal(await page.locator('.library-reader').count(), 0);
        await page.goto('http://127.0.0.1:5173/library/missing');
        await page.getByRole('heading', { name: 'nothing on this shelf' }).waitFor();
        assert.deepEqual(errors, []);
        console.log(`PASS ${engine.name()} ${mobile ? 'phone' : 'desktop'}: filters, shared URLs, history, custom types, shelf, data, focus, quick-close race, fallback, reduced motion and clean detail routes`);
        await context.close();
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exit(1); });
