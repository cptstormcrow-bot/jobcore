import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatVersionLabel } from '../formatVersionLabel';

test('version with build', () => {
  assert.equal(formatVersionLabel({ version: '0.2.0', build: '5' }), 'Version 0.2.0 (build 5)');
});
test('version without build', () => {
  assert.equal(formatVersionLabel({ version: '0.2.0', build: null }), 'Version 0.2.0');
});
test('null info', () => {
  assert.equal(formatVersionLabel(null), 'Version unknown');
});
