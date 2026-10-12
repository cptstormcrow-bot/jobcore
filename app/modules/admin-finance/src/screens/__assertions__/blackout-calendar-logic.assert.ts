/**
 * Assertions for blackout-calendar-logic (pure, no side effects, no React).
 * Runs under `node --experimental-strip-types --test`; all values are fixed literals.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BLACKOUT_WEEK_VIEW_KEY,
  modeFromPref,
  readCalMode,
  writeCalMode,
  filterTimeOffByTech,
  expandBlackoutsToEvents,
} from '../blackout-calendar-logic';
import type { TimeOffRequestAdmin, TimeOffStatus } from '../../data/time-off-repo';

function row(
  id: string,
  techId: string,
  startDate: string,
  endDate: string,
  status: TimeOffStatus,
): TimeOffRequestAdmin {
  return {
    id,
    organizationId: 'org-1',
    techId,
    startDate,
    endDate,
    reason: 'r-' + id,
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdByAdminId: null,
  };
}

function fakePrefs() {
  const store = new Map<string, boolean>();
  return {
    store,
    async getBool(key: string, d: boolean) {
      return store.has(key) ? (store.get(key) as boolean) : d;
    },
    async setBool(key: string, v: boolean) {
      store.set(key, v);
    },
  };
}

test('expandBlackoutsToEvents: pending and approved expand, denied and cancelled do not', () => {
  const out = expandBlackoutsToEvents([
    row('p', 't1', '2026-03-01', '2026-03-01', 'pending'),
    row('a', 't1', '2026-03-02', '2026-03-02', 'approved'),
    row('d', 't1', '2026-03-03', '2026-03-03', 'denied'),
    row('c', 't1', '2026-03-04', '2026-03-04', 'cancelled'),
  ]);
  assert.deepEqual(out.map((e) => e.id), ['p', 'a']);
});

test('expandBlackoutsToEvents: multi-day carries span, single day yields one event', () => {
  const multi = expandBlackoutsToEvents([row('m', 't1', '2026-03-10', '2026-03-12', 'approved')]);
  assert.equal(multi.length, 1);
  assert.equal(multi[0]?.startDate, '2026-03-10');
  assert.equal(multi[0]?.endDate, '2026-03-12');
  const single = expandBlackoutsToEvents([row('s', 't1', '2026-03-10', '2026-03-10', 'pending')]);
  assert.equal(single.length, 1);
  assert.equal(single[0]?.startDate, single[0]?.endDate);
});

test('modeFromPref and key', () => {
  assert.equal(modeFromPref(undefined), 'month');
  assert.equal(modeFromPref(null), 'month');
  assert.equal(modeFromPref(false), 'month');
  assert.equal(modeFromPref(true), 'week');
  assert.equal(BLACKOUT_WEEK_VIEW_KEY, 'admin-finance.blackout.week-view');
});

test('readCalMode without a port is month', async () => {
  assert.equal(await readCalMode(undefined), 'month');
  assert.equal(await readCalMode(null), 'month');
});

test('writeCalMode stores booleans and round-trips', async () => {
  const p = fakePrefs();
  await writeCalMode(p, 'week');
  assert.equal(p.store.get(BLACKOUT_WEEK_VIEW_KEY), true);
  assert.equal(await readCalMode(p), 'week');
  await writeCalMode(p, 'month');
  assert.equal(p.store.get(BLACKOUT_WEEK_VIEW_KEY), false);
  assert.equal(await readCalMode(p), 'month');
});

test('filterTimeOffByTech: all, one tech, unknown, sorted ascending', () => {
  const rows = [
    row('3', 't2', '2026-05-03', '2026-05-03', 'approved'),
    row('1', 't1', '2026-05-01', '2026-05-01', 'pending'),
    row('x', 't1', '2026-05-02', '2026-05-02', 'cancelled'),
    row('2', 't1', '2026-05-02', '2026-05-02', 'denied'),
  ];
  assert.deepEqual(filterTimeOffByTech(rows, 'all').map((r) => r.id), ['1', '2', '3']);
  assert.deepEqual(filterTimeOffByTech(rows, 't1').map((r) => r.id), ['1', '2']);
  assert.deepEqual(filterTimeOffByTech(rows, 'nobody'), []);
});
