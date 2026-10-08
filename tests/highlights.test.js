import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHighlights } from '../src/lib/highlights.js';

const post = (slug, views, extra = {}) => ({ slug, views, publishedAt: '2026-09-01T12:00:00Z', ...extra });

test('highlights are the three most viewed posts, most viewed first', () => {
  const picks = selectHighlights([post('a', 4), post('b', 40), post('c', 0), post('d', 12), post('e', 7)]);
  assert.deepEqual(picks.map(item => item.slug), ['b', 'd', 'e']);
});

test('views outrank featured; featured then newest break ties', () => {
  const picks = selectHighlights([
    post('old', 0, { publishedAt: '2026-08-01T00:00:00Z' }),
    post('featured', 0, { featured: true, publishedAt: '2026-07-01T00:00:00Z' }),
    post('new', 0, { publishedAt: '2026-10-06T17:33:00.000-04:00' }),
    post('viewed', 1),
  ]);
  assert.deepEqual(picks.map(item => item.slug), ['viewed', 'featured', 'new']);
});

test('missing or malformed counts and dates never break ordering', () => {
  const picks = selectHighlights([post('x', null, { publishedAt: null }), post('y', '3'), post('z', undefined)]);
  assert.deepEqual(picks.map(item => item.slug), ['y', 'z', 'x']);
  assert.deepEqual(selectHighlights(), []);
});
