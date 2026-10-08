import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDocumentView, screenViewRequest } from '../server/recordView.js';
import handler from '../api/record-view.js';

test('invalid inputs never reach Sanity, including null and inherited object keys', async () => {
  for (const input of [null, {}, [], { type: 'constructor', slug: 'book' }, { type: 'note', slug: {} }, { type: 'note', slug: 'x'.repeat(201) }]) {
    assert.equal((await recordDocumentView(input)).status, 400);
  }
});

test('recording uses a published document and increments only its view count', async t => {
  const previous = process.env.SANITY_API_WRITE_TOKEN;
  process.env.SANITY_API_WRITE_TOKEN = 'test-token';
  t.after(() => { if (previous === undefined) delete process.env.SANITY_API_WRITE_TOKEN; else process.env.SANITY_API_WRITE_TOKEN = previous; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: new URL(url), options });
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ result: 'published-note-id' }) };
  });
  assert.deepEqual(await recordDocumentView({ type: 'note', slug: ' test-note ' }), { ok: true, status: 200 });
  assert.equal(calls[0].url.searchParams.get('perspective'), 'published');
  assert.equal(calls[0].url.searchParams.get('$slug'), '"test-note"');
  assert.deepEqual(JSON.parse(calls[1].options.body), { mutations: [
    { createIfNotExists: { _id: 'viewcount-published-note-id', _type: 'viewCount', document: { _type: 'reference', _ref: 'published-note-id', _weak: true }, count: 0 } },
    { patch: { id: 'viewcount-published-note-id', inc: { count: 1 } } },
  ] }, 'counts live outside the post so republishing cannot reset them');
});

test('offline Sanity and drafts return controlled errors without attempting a mutation', async t => {
  const previous = process.env.SANITY_API_WRITE_TOKEN;
  process.env.SANITY_API_WRITE_TOKEN = 'test-token';
  t.after(() => { if (previous === undefined) delete process.env.SANITY_API_WRITE_TOKEN; else process.env.SANITY_API_WRITE_TOKEN = previous; });
  const mocked = t.mock.method(globalThis, 'fetch', async () => { throw new Error('network unavailable'); });
  assert.equal((await recordDocumentView({ type: 'article', slug: 'test' })).status, 502);
  mocked.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ result: 'drafts.test' }) }));
  assert.equal((await recordDocumentView({ type: 'article', slug: 'test' })).status, 404);
  assert.equal(mocked.mock.callCount(), 2);
});

test('view API handles malformed JSON and JSON null as client errors', async () => {
  for (const body of ['{', 'null']) {
    const response = { statusCode: null, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; } };
    await handler({ method: 'POST', body }, response);
    assert.equal(response.statusCode, 400);
  }
});

const browser = (overrides = {}) => ({
  host: 'www.bynickthomas.com',
  origin: 'https://www.bynickthomas.com',
  'content-type': 'application/json',
  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  'x-forwarded-for': '203.0.113.7',
  ...overrides,
});

test('only same-site JSON requests from real browsers may count a view', () => {
  const now = 1_000_000;
  const screen = (headers, slug = 'post') => screenViewRequest({ headers, type: 'article', slug, now });
  assert.equal(screen(browser({ 'content-type': 'text/plain' }))?.status, 415, 'no-preflight cross-site bodies are refused');
  assert.equal(screen(browser({ origin: 'https://evil.example' }))?.status, 403);
  assert.equal(screen(browser({ origin: undefined }))?.status, 403, 'scripts without an Origin are refused');
  assert.equal(screen(browser({ origin: 'not a url' }))?.status, 403);
  assert.deepEqual(screen(browser({ 'user-agent': 'Googlebot/2.1' })), { status: 204, skipped: true });
  assert.equal(screen(browser({ 'x-forwarded-for': '198.51.100.1' }), 'fresh'), null);
  assert.equal(screen(browser({ host: 'nick-preview.vercel.app', origin: 'https://nick-preview.vercel.app', 'x-forwarded-for': '198.51.100.2' }), 'fresh'), null, 'previews count against their own host');
});

test('repeat views from one visitor are not counted twice within half an hour', () => {
  const headers = browser({ 'x-forwarded-for': '192.0.2.44' });
  const first = 5_000_000;
  assert.equal(screenViewRequest({ headers, type: 'note', slug: 'repeat', now: first }), null);
  assert.deepEqual(screenViewRequest({ headers, type: 'note', slug: 'repeat', now: first + 60_000 }), { status: 204, skipped: true });
  assert.equal(screenViewRequest({ headers, type: 'note', slug: 'other', now: first + 60_000 }), null, 'other posts still count');
  assert.equal(screenViewRequest({ headers, type: 'note', slug: 'repeat', now: first + 31 * 60_000 }), null);
});

test('the view API refuses cross-site requests before touching Sanity', async t => {
  const mocked = t.mock.method(globalThis, 'fetch', async () => { throw new Error('should not be called'); });
  const response = { statusCode: null, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; }, end() {} };
  await handler({ method: 'POST', headers: browser({ origin: 'https://elsewhere.example' }), body: { type: 'article', slug: 'post' } }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(mocked.mock.callCount(), 0);
});
