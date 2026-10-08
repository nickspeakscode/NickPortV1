import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const header = name => config.headers.find(rule => rule.source === '/(.*)')?.headers.find(h => h.key === name)?.value ?? '';

test('every page ships a content security policy that blocks framing and foreign scripts', () => {
  const csp = header('Content-Security-Policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/, 'no inline or third-party scripts');
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(header('X-Frame-Options'), 'DENY');
});

test('the policy allows exactly the services the site talks to', async () => {
  const csp = header('Content-Security-Policy');
  const sanity = await readFile(new URL('../src/lib/sanity.js', import.meta.url), 'utf8');
  const ticker = await readFile(new URL('../src/lib/marketTicker.js', import.meta.url), 'utf8');
  assert.ok(sanity.includes('apicdn.sanity.io') && csp.includes('https://vzrug3c0.apicdn.sanity.io'), 'Sanity CDN reads');
  assert.ok(csp.includes('https://cdn.sanity.io'), 'Sanity images and video');
  assert.ok(ticker.includes('wss://ws.kraken.com') && csp.includes('wss://ws.kraken.com'), 'live crypto quotes');
  assert.ok(csp.includes('https://fonts.googleapis.com') && csp.includes('https://fonts.gstatic.com'), 'Google Fonts');
});

test('the hidden timeline stays out of search results', () => {
  const rule = config.headers.find(r => r.source.startsWith('/timeline'));
  assert.equal(rule?.headers.find(h => h.key === 'X-Robots-Tag')?.value, 'noindex, nofollow');
});
