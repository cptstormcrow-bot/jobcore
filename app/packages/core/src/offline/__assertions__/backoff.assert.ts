import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeBackoffMs } from '../replay.js';

test('computeBackoffMs: 1 -> 2000, 2 -> 4000, 3 -> 8000', () => {
  assert.equal(computeBackoffMs(1), 2000);
  assert.equal(computeBackoffMs(2), 4000);
  assert.equal(computeBackoffMs(3), 8000);
});

test('computeBackoffMs: attempts <= 1 returns base', () => {
  assert.equal(computeBackoffMs(0), 2000);
  assert.equal(computeBackoffMs(-3), 2000);
});

test('computeBackoffMs: caps at 300000', () => {
  assert.equal(computeBackoffMs(20), 300000);
  assert.equal(computeBackoffMs(9), 300000);
});

test('computeBackoffMs: honours custom options', () => {
  assert.equal(computeBackoffMs(3, { baseMs: 100, factor: 3, maxMs: 500 }), 500);
  assert.equal(computeBackoffMs(2, { baseMs: 100, factor: 3, maxMs: 5000 }), 300);
});
