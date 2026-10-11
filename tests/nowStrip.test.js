import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNowItems } from '../src/lib/nowStrip.js';
import { isRecent } from '../src/lib/freshness.js';

const day = 86400000;

test('a library item is new for 14 days after it is created', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  assert.equal(isRecent('2026-10-10T23:51:12Z', now), true);
  assert.equal(isRecent('2026-09-28T12:00:00Z', now), true, 'just under 14 days');
  assert.equal(isRecent('2026-09-27T11:59:00Z', now), false, 'over 14 days');
  assert.equal(isRecent('2026-10-12T00:00:00Z', now), false, 'future dates are not new');
  assert.equal(isRecent(undefined, now), false);
  assert.equal(isRecent('not a date', now), false);
});

test('the now strip reads, studies, then the latest note, capped at three', () => {
  const items = buildNowItems({
    resources: [
      { title: 'Done', slug: 'done', status: 'Completed', resourceType: 'Book' },
      { title: 'Naked Statistics', slug: 'naked-statistics', status: 'Currently Learning', resourceType: 'Book', progress: 5 },
      { title: 'CMA Part 1', slug: 'cma', status: 'Currently Learning', resourceType: 'Certification', progress: 10 },
    ],
    notes: [{ title: 'Still Learning', slug: 'still', displayDate: 'Oct 6, 2026' }, { title: 'Older', slug: 'older' }],
    articles: [{ title: 'Art', slug: 'art', displayDate: 'Sep 8, 2026' }],
  });
  assert.deepEqual(items.map(item => [item.label, item.title, item.meta, item.href]), [
    ['Reading', 'Naked Statistics', '5%', '/library/naked-statistics'],
    ['Studying', 'CMA Part 1', '', '/library/cma'],
    ['Latest note', 'Still Learning', 'Oct 6, 2026', '/notes/still'],
  ]);
});

test('with nothing in progress the latest musing fills in; empty data yields nothing', () => {
  const items = buildNowItems({ resources: [], notes: [{ title: 'N', slug: 'n' }], articles: [{ title: 'A', slug: 'a' }] });
  assert.deepEqual(items.map(item => item.label), ['Latest note', 'Latest musing']);
  assert.deepEqual(buildNowItems(), []);
  assert.deepEqual(buildNowItems({ resources: [{ title: 'No slug', status: 'Currently Learning' }] }), []);
});

test('featured and display order pick the headline read; zero progress shows no percentage', () => {
  const items = buildNowItems({ resources: [
    { title: 'Second', slug: 'b', status: 'Currently Learning', resourceType: 'Book', displayOrder: 2, progress: 0 },
    { title: 'First', slug: 'a', status: 'In Progress', resourceType: 'Book', displayOrder: 1, progress: 0 },
  ] });
  assert.equal(items[0].title, 'First');
  assert.equal(items[0].meta, '');
  assert.equal(items.length, 1, 'only one reading item, and no duplicate');
  assert.ok(Date.now() - day > 0);
});
