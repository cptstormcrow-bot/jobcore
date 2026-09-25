/**
 * Assertions for `formatServiceTaskNumber` (F11 slice S6).
 *
 * Runs under `node --experimental-strip-types --test` — zero setup: no DB,
 * no network, no env vars, no faked clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatServiceTaskNumber } from '../format-service-task-number';

test('finite taskNumber is zero-padded to 12 digits', () => {
  assert.equal(formatServiceTaskNumber({ id: 'x', taskNumber: 306 }), 'ST-000000000306');
});

test('null taskNumber falls back to the UUID tail', () => {
  assert.equal(
    formatServiceTaskNumber({ id: '00000000-0000-4000-8000-000000000306', taskNumber: null }),
    'ST-000000000306',
  );
});

test('undefined taskNumber falls back to the UUID tail', () => {
  assert.equal(
    formatServiceTaskNumber({ id: '00000000-0000-4000-8000-000000000306' }),
    'ST-000000000306',
  );
});

test('UUID tail fallback uses the last hyphen-separated group', () => {
  assert.equal(
    formatServiceTaskNumber({ id: 'a1b2c3d4-0000-4000-8000-abcdef123456', taskNumber: null }),
    'ST-abcdef123456',
  );
});

test('large taskNumber is not truncated', () => {
  assert.equal(formatServiceTaskNumber({ id: 'x', taskNumber: 1234567890123 }), 'ST-1234567890123');
});
