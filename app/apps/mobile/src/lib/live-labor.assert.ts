/**
 * Assertions for liveLaborSeconds. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { liveLaborSeconds } from './live-labor';

const START = '2026-01-01T10:00:00.000Z';
const START_MS = Date.parse(START);

test('not started returns stored', () => {
  assert.equal(
    liveLaborSeconds({ storedSeconds: 120, openSegmentStartIso: null, completedAt: null, nowMs: START_MS + 99000 }),
    120,
  );
  assert.equal(
    liveLaborSeconds({ storedSeconds: 120, openSegmentStartIso: undefined, completedAt: undefined, nowMs: START_MS }),
    120,
  );
});

test('open job adds elapsed seconds', () => {
  assert.equal(
    liveLaborSeconds({ storedSeconds: 100, openSegmentStartIso: START, completedAt: null, nowMs: START_MS + 45000 }),
    145,
  );
});

test('completed returns stored', () => {
  assert.equal(
    liveLaborSeconds({
      storedSeconds: 100,
      openSegmentStartIso: START,
      completedAt: '2026-01-01T11:00:00.000Z',
      nowMs: START_MS + 45000,
    }),
    100,
  );
});

test('clock skew (start in the future) returns stored', () => {
  assert.equal(
    liveLaborSeconds({ storedSeconds: 100, openSegmentStartIso: START, completedAt: null, nowMs: START_MS - 5000 }),
    100,
  );
});

test('invalid ISO returns stored', () => {
  assert.equal(
    liveLaborSeconds({ storedSeconds: 100, openSegmentStartIso: 'not-a-date', completedAt: null, nowMs: START_MS }),
    100,
  );
});

test('negative or NaN stored floors to 0', () => {
  assert.equal(liveLaborSeconds({ storedSeconds: -50, openSegmentStartIso: null, completedAt: null, nowMs: 0 }), 0);
  assert.equal(liveLaborSeconds({ storedSeconds: NaN, openSegmentStartIso: null, completedAt: null, nowMs: 0 }), 0);
  assert.equal(
    liveLaborSeconds({ storedSeconds: -50, openSegmentStartIso: START, completedAt: null, nowMs: START_MS + 10000 }),
    10,
  );
});

test('elapsed floors to whole seconds', () => {
  assert.equal(
    liveLaborSeconds({ storedSeconds: 0, openSegmentStartIso: START, completedAt: null, nowMs: START_MS + 1999 }),
    1,
  );
});
