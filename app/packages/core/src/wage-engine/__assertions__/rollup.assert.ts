import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allocateWorkweek, DEFAULT_OVERTIME_CONFIG } from '../ca-overtime.js';
import { dayOfWeek } from '../periods.js';
import { allocateRange, currentPeriodMinutes, rollup, rollupKey, workedDaysFromEntries } from '../rollup.js';
import type { RollupGranularity, WorkedDay } from '../types.js';

const WEEK = { weekStartDow: 1, anchorDate: '2026-10-12' };
const OT = DEFAULT_OVERTIME_CONFIG;
const GRANS: RollupGranularity[] = ['day', 'week', 'month', 'year'];

function find(rows: ReturnType<typeof rollup>, key: string) {
  const r = rows.find((x) => x.key === key);
  assert.ok(r, `row ${key} missing`);
  return r;
}

test('anchor 2026-10-12 is a Monday', () => {
  assert.equal(dayOfWeek('2026-10-12'), 1);
});

test('empty input -> [] for all granularities', () => {
  for (const g of GRANS) assert.deepEqual(rollup([], g, OT, WEEK), []);
});

test('Mon-Fri 9h: week 2400 reg / 300 ot; days 480 / 60', () => {
  const days = ['12', '13', '14', '15', '16'].map((d) => ({ workDate: `2026-10-${d}`, minutes: 540 }));
  const wk = rollup(days, 'week', OT, WEEK);
  assert.equal(wk.length, 1);
  assert.deepEqual(wk[0], {
    granularity: 'week',
    key: '2026-10-12',
    regularMin: 2400,
    otMin: 300,
    dtMin: 0,
    totalMin: 2700,
  });
  const dr = rollup(days, 'day', OT, WEEK);
  assert.equal(dr.length, 5);
  for (const r of dr) {
    assert.equal(r.regularMin, 480);
    assert.equal(r.otMin, 60);
    assert.equal(r.dtMin, 0);
  }
});

test('month straddle splits by day', () => {
  const days = [
    { workDate: '2026-09-30', minutes: 480 },
    { workDate: '2026-10-01', minutes: 480 },
  ];
  const m = rollup(days, 'month', OT, WEEK);
  assert.equal(m.length, 2);
  assert.equal(find(m, '2026-09').totalMin, 480);
  assert.equal(find(m, '2026-10').totalMin, 480);
  const w = rollup(days, 'week', OT, WEEK);
  assert.equal(w.length, 1);
  assert.equal(find(w, '2026-09-28').totalMin, 960);
  const y = rollup(days, 'year', OT, WEEK);
  assert.equal(find(y, '2026').totalMin, 960);
});

test('year straddle splits by day', () => {
  const days = [
    { workDate: '2026-12-30', minutes: 480 },
    { workDate: '2027-01-01', minutes: 480 },
  ];
  const y = rollup(days, 'year', OT, WEEK);
  assert.equal(y.length, 2);
  assert.equal(find(y, '2026').totalMin, 480);
  assert.equal(find(y, '2027').totalMin, 480);
  const w = rollup(days, 'week', OT, WEEK);
  assert.equal(w.length, 1);
  assert.equal(w[0]!.key, '2026-12-28');
  assert.equal(w[0]!.totalMin, 960);
});

test('duplicate workDate entries merge', () => {
  const days = [
    { workDate: '2026-10-12', minutes: 240 },
    { workDate: '2026-10-12', minutes: 240 },
  ];
  const d = rollup(days, 'day', OT, WEEK);
  assert.equal(d.length, 1);
  assert.equal(d[0]!.regularMin, 480);
  assert.equal(d[0]!.totalMin, 480);
});

test('invariant: totals match input and allocateRange per bucket', () => {
  const days: WorkedDay[] = [
    { workDate: '2026-09-29', minutes: 600 },
    { workDate: '2026-09-30', minutes: 800 },
    { workDate: '2026-10-02', minutes: 300 },
    { workDate: '2026-10-12', minutes: 540 },
    { workDate: '2026-10-13', minutes: 540 },
    { workDate: '2026-10-14', minutes: 540 },
    { workDate: '2026-10-15', minutes: 540 },
    { workDate: '2026-10-16', minutes: 540 },
    { workDate: '2026-10-17', minutes: 300 },
    { workDate: '2026-12-31', minutes: 200 },
    { workDate: '2027-01-01', minutes: 100 },
  ];
  const inputSum = days.reduce((s, d) => s + d.minutes, 0);
  const alloc = allocateRange(days, OT, WEEK);
  for (const g of GRANS) {
    const rows = rollup(days, g, OT, WEEK);
    assert.equal(rows.reduce((s, r) => s + r.totalMin, 0), inputSum);
    for (const r of rows) {
      const inBucket = alloc.filter((a) => {
        const k =
          g === 'day'
            ? a.workDate
            : g === 'month'
              ? a.workDate.slice(0, 7)
              : g === 'year'
                ? a.workDate.slice(0, 4)
                : rollup([{ workDate: a.workDate, minutes: 1 }], 'week', OT, WEEK)[0]!.key;
        return k === r.key;
      });
      assert.equal(r.totalMin, inBucket.reduce((s, a) => s + a.regularMin + a.otMin + a.dtMin, 0));
    }
  }
});

test('rows ascend by key with unsorted input', () => {
  const days = [
    { workDate: '2026-10-20', minutes: 100 },
    { workDate: '2026-10-05', minutes: 100 },
    { workDate: '2026-10-13', minutes: 100 },
  ];
  for (const g of GRANS) {
    const keys = rollup(days, g, OT, WEEK).map((r) => r.key);
    assert.deepEqual(keys, [...keys].sort());
  }
  assert.deepEqual(
    rollup(days, 'day', OT, WEEK).map((r) => r.key),
    ['2026-10-05', '2026-10-13', '2026-10-20'],
  );
});

test('7-day week matches allocateWorkweek totals', () => {
  const days = [12, 13, 14, 15, 16, 17, 18].map((d) => ({ workDate: `2026-10-${d}`, minutes: 480 }));
  const t = allocateWorkweek(days, OT, '2026-10-12').totals;
  const wk = rollup(days, 'week', OT, WEEK);
  assert.equal(wk.length, 1);
  assert.equal(wk[0]!.regularMin, t.regularMin);
  assert.equal(wk[0]!.otMin, t.otMin);
  assert.equal(wk[0]!.dtMin, t.dtMin);
});

test('negative minutes throw RangeError', () => {
  assert.throws(() => rollup([{ workDate: '2026-10-12', minutes: -1 }], 'day', OT, WEEK), RangeError);
});

const ent = (workDate: string, minutes: number, status = 'approved') => ({ workDate, minutes, status });
const MON = { weekStartDow: 1, anchorDate: '2026-10-12' };
const SUN = { weekStartDow: 0, anchorDate: '2026-10-11' };

test('workedDaysFromEntries drops rejected and sums per workDate', () => {
  const days = workedDaysFromEntries([
    ent('2026-10-12', 60),
    ent('2026-10-12', 30),
    ent('2026-10-13', 999, 'rejected'),
  ] as never);
  assert.deepEqual(days, [{ workDate: '2026-10-12', minutes: 90 }]);
});

test('currentPeriodMinutes: Monday vs Sunday week start differ across Sun/Mon', () => {
  const entries = [ent('2026-10-11', 60), ent('2026-10-12', 120)] as never;
  assert.equal(currentPeriodMinutes(entries, '2026-10-12', MON).weekMin, 120);
  assert.equal(currentPeriodMinutes(entries, '2026-10-12', SUN).weekMin, 180);
});

test('currentPeriodMinutes: multi-day sums per bucket', () => {
  const entries = [ent('2026-10-12', 60), ent('2026-10-13', 120), ent('2026-10-14', 30)] as never;
  const r = currentPeriodMinutes(entries, '2026-10-14', MON);
  assert.equal(r.weekMin, 210);
  assert.equal(r.monthMin, 210);
  assert.equal(r.yearMin, 210);
});

test('currentPeriodMinutes: month straddles a week (weekMin < monthMin)', () => {
  const entries = [ent('2026-10-01', 60), ent('2026-10-12', 60)] as never;
  const r = currentPeriodMinutes(entries, '2026-10-12', MON);
  assert.ok(r.weekMin < r.monthMin);
  assert.equal(r.weekMin, 60);
  assert.equal(r.monthMin, 120);
});

test('currentPeriodMinutes: no entries or missing bucket -> 0', () => {
  assert.deepEqual(currentPeriodMinutes([], '2026-10-12', MON), { weekMin: 0, monthMin: 0, yearMin: 0 });
  const r = currentPeriodMinutes([ent('2025-01-06', 60)] as never, '2026-10-12', MON);
  assert.deepEqual(r, { weekMin: 0, monthMin: 0, yearMin: 0 });
});

test('currentPeriodMinutes matches matching rollup() rows', () => {
  const entries = [ent('2026-10-01', 480), ent('2026-10-12', 540), ent('2026-10-13', 540)] as never;
  const days = workedDaysFromEntries(entries);
  const today = '2026-10-13';
  const r = currentPeriodMinutes(entries, today, MON);
  const pick = (g: RollupGranularity) =>
    rollup(days, g, OT, MON).find((x) => x.key === rollupKey(today, g, MON))?.totalMin ?? 0;
  assert.equal(r.weekMin, pick('week'));
  assert.equal(r.monthMin, pick('month'));
  assert.equal(r.yearMin, pick('year'));
});
