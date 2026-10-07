import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSitemap, renderSitemap } from '../server/sitemap.js';

test('sitemap lists static pages and clean content URLs with escaping', () => {
  const xml = renderSitemap([
    { _type: 'article', slug: 'right-about-the-trade', _updatedAt: '2026-09-05T12:00:00Z' },
    { _type: 'learningNote', slug: 'a&b', _updatedAt: '2026-10-06T17:33:00Z' },
    { _type: 'learningResource', slug: 'naked-statistics' },
    { _type: 'unknown', slug: 'ignored' },
    { _type: 'article', slug: null },
  ]);
  for (const path of ['/', '/writing/', '/library/', '/notes/']) {
    assert.ok(xml.includes(`<loc>https://www.bynickthomas.com${path}</loc>`), path);
  }
  assert.ok(xml.includes('<loc>https://www.bynickthomas.com/writing/right-about-the-trade</loc><lastmod>2026-09-05</lastmod>'));
  assert.ok(xml.includes('<loc>https://www.bynickthomas.com/notes/a%26b</loc>'));
  assert.ok(xml.includes('<loc>https://www.bynickthomas.com/library/naked-statistics</loc></url>'));
  assert.ok(!xml.includes('ignored'));
  assert.ok(!xml.includes('timeline'));
  assert.equal((xml.match(/<url>/g) ?? []).length, 7);
});

test('a CMS failure still returns the static pages', async () => {
  const failed = await buildSitemap(async () => ({ ok: false, status: 503 }));
  assert.equal(failed.complete, false);
  assert.equal((failed.xml.match(/<url>/g) ?? []).length, 4);

  const thrown = await buildSitemap(async () => { throw new Error('offline'); });
  assert.equal(thrown.complete, false);

  const ok = await buildSitemap(async (url) => {
    assert.match(String(url), /apicdn\.sanity\.io/);
    return { ok: true, json: async () => ({ result: [{ _type: 'article', slug: 'x' }] }) };
  });
  assert.equal(ok.complete, true);
  assert.ok(ok.xml.includes('/writing/x</loc>'));
});
