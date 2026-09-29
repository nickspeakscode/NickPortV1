import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDocumentView } from '../server/recordView.js';
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
  assert.deepEqual(JSON.parse(calls[1].options.body), { mutations: [{ patch: { id: 'published-note-id', setIfMissing: { views: 0 }, inc: { views: 1 } } }] });
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
