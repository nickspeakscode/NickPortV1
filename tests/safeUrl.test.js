import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHref } from '../src/lib/safeUrl.js';

test('CMS links support web, email and relative destinations', () => {
  for (const href of ['https://example.com/credential', '/library/book', '#notes', 'mailto:nick@example.com']) {
    assert.equal(safeHref(href), href);
  }
});

test('script and data protocols cannot become clickable CMS links', () => {
  for (const href of ['javascript:alert(1)', ' \tJaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,test', 'file:///C:/private', null, {}]) {
    assert.equal(safeHref(href), '');
  }
  assert.equal(safeHref('mailto:nick@example.com', ['http:', 'https:']), '');
});
