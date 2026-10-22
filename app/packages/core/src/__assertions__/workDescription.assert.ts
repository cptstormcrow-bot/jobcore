import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summarizeWorkDescription as s } from '../workDescription.js';

test('dedupe and trim keep first spelling', () => {
  assert.equal(s(['  Fix Sink ', 'fix sink', 'Paint']), 'Fix Sink; Paint');
});
test('caps at 3 titles with +N more', () => {
  assert.equal(s(['a', 'b', 'c', 'd', 'e']), 'a; b; c +2 more');
});
test('clips long title to 40 with three dots', () => {
  const out = s(['x'.repeat(50)]);
  assert.equal(out, 'x'.repeat(37) + '...');
  assert.equal(out.length, 40);
});
test('blanks and nulls ignored', () => {
  assert.equal(s(['', '  ', null, undefined, 'Real']), 'Real');
});
test('fallback first line', () => {
  assert.equal(s([], '\n  Replace door \nSecond line'), 'Replace door');
});
test('fallback drops Service line but keeps another', () => {
  assert.equal(s([null], 'Service: Foo\nDo the thing'), 'Do the thing');
});
test('fallback of only Service line returns the name', () => {
  assert.equal(s([], 'service:  Foo '), 'Foo');
});
test('empty everything returns empty string', () => {
  assert.equal(s([], null), '');
  assert.equal(s([], undefined), '');
  assert.equal(s([], ''), '');
});
test('maxChars clips titles and fallback', () => {
  assert.equal(s(['abcdefghij'], null, { maxChars: 8 }), 'abcde...');
  assert.equal(s([], 'abcdefghij', { maxChars: 8 }), 'abcde...');
});
