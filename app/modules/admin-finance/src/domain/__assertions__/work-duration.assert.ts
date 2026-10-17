/**
 * Assertions for workDurationMs / formatWorkDuration. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { workDurationMs, formatWorkDuration } from '../work-duration';

const j = (over: Record<string, unknown>) => ({ enRouteAt: null, inProgressAt: null, completedAt: null, ...over }) as any;

test('inProgressAt preferred over enRouteAt', () => {
  const ms = workDurationMs(j({ enRouteAt: '2026-01-01T08:00:00Z', inProgressAt: '2026-01-01T09:00:00Z', completedAt: '2026-01-01T11:15:00Z' }));
  assert.equal(ms, 135 * 60000);
});

test('falls back to enRouteAt', () => {
  assert.equal(workDurationMs(j({ enRouteAt: '2026-01-01T08:00:00Z', completedAt: '2026-01-01T08:45:00Z' })), 45 * 60000);
});

test('null when start or end missing, or end before start', () => {
  assert.equal(workDurationMs(j({ completedAt: '2026-01-01T08:45:00Z' })), null);
  assert.equal(workDurationMs(j({ inProgressAt: '2026-01-01T08:00:00Z' })), null);
  assert.equal(workDurationMs(j({ inProgressAt: '2026-01-01T09:00:00Z', completedAt: '2026-01-01T08:00:00Z' })), null);
});

test('formatWorkDuration', () => {
  assert.equal(formatWorkDuration(135 * 60000), '2h 15m');
  assert.equal(formatWorkDuration(45 * 60000), '45m');
  assert.equal(formatWorkDuration(120 * 60000), '2h 0m');
  assert.equal(formatWorkDuration(null), '-');
});
