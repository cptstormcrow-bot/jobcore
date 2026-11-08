import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInstructionsUrl } from '../normalize-instructions-url';

test('blank becomes null', () => {
  assert.equal(normalizeInstructionsUrl(''), null);
  assert.equal(normalizeInstructionsUrl('   '), null);
  assert.equal(normalizeInstructionsUrl(null), null);
});
test('missing scheme gets https and spaces are trimmed', () => {
  assert.equal(normalizeInstructionsUrl('  youtu.be/abc123 '), 'https://youtu.be/abc123');
  assert.equal(normalizeInstructionsUrl('www.site.com/a.pdf'), 'https://www.site.com/a.pdf');
});
test('http and https are kept as typed', () => {
  assert.equal(normalizeInstructionsUrl('http://a.com/x.mp4'), 'http://a.com/x.mp4');
  assert.equal(normalizeInstructionsUrl('HTTPS://A.com/x.mov'), 'HTTPS://A.com/x.mov');
});
test('other schemes and junk are rejected', () => {
  assert.equal(normalizeInstructionsUrl('javascript:alert(1)'), null);
  assert.equal(normalizeInstructionsUrl('ftp://a.com/x'), null);
  assert.equal(normalizeInstructionsUrl('not a link'), null);
});
