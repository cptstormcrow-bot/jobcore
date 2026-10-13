import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_OVERTIME_CONFIG, allocateDay, allocateWorkweek } from '../ca-overtime.js';

const C = DEFAULT_OVERTIME_CONFIG;

function run(mins: number[], start = '2026-10-04', config = C) {
  const days = mins.map((minutes, i) => ({
    workDate: new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10),
    minutes,
  }));
  void start;
  return allocateWorkweek(days, config);
}

function t(w: { totals: { regularMin: number; otMin: number; dtMin: number } }) {
  return [w.totals.regularMin, w.totals.otMin, w.totals.dtMin];
}

test('allocateDay: golden splits', () => {
  assert.deepEqual(allocateDay(480, C), { regularMin: 480, otMin: 0, dtMin: 0 });
  assert.deepEqual(allocateDay(540, C), { regularMin: 480, otMin: 60, dtMin: 0 });
  assert.deepEqual(allocateDay(750, C), { regularMin: 480, otMin: 240, dtMin: 30 });
  assert.deepEqual(allocateDay(0, C), { regularMin: 0, otMin: 0, dtMin: 0 });
});

test('allocateDay: rejects bad input', () => {
  assert.throws(() => allocateDay(-1, C), RangeError);
  assert.throws(() => allocateDay(1.5, C), RangeError);
  assert.throws(() => allocateDay(Number.NaN, C), RangeError);
  assert.throws(() => allocateDay(60, { ...C, dailyOtAfterMin: 800 }), RangeError);
});

test('allocateWorkweek: weekly overtime', () => {
  assert.deepEqual(t(run([540, 540, 540, 540, 540])), [2400, 300, 0]);
  assert.deepEqual(t(run([510, 510, 510, 510, 510])), [2400, 150, 0]);
  const six = run([480, 480, 480, 480, 480, 480]);
  assert.deepEqual(t(six), [2400, 480, 0]);
  assert.equal(six.days[5]!.otMin, 480);
  assert.equal(six.days[0]!.regularMin, 480);
});

test('allocateWorkweek: 7th day rule', () => {
  const seven = run([480, 480, 480, 480, 480, 480, 480]);
  assert.deepEqual(t(seven), [2400, 960, 0]);
  assert.equal(seven.days[6]!.seventhDay, true);
  assert.deepEqual(t(run([480, 480, 480, 480, 480, 480, 600])), [2400, 960, 120]);
  assert.deepEqual(t(run([360, 360, 360, 360, 360, 360, 360])), [2160, 360, 0]);
  assert.deepEqual(
    t(run([360, 360, 360, 360, 360, 360, 360], '2026-10-04', { ...C, seventhDayRule: false })),
    [2400, 120, 0],
  );
});

test('allocateWorkweek: day off means no 7th day', () => {
  const w = run([480, 480, 480, 0, 480, 480, 480]);
  assert.deepEqual(t(w), [2400, 480, 0]);
  assert.ok(w.days.every((d) => !d.seventhDay));
});

test('allocateWorkweek: duplicates merge, weekStart sets weekEnd', () => {
  const w = allocateWorkweek(
    [
      { workDate: '2026-10-05', minutes: 240 },
      { workDate: '2026-10-05', minutes: 240 },
    ],
    C,
    '2026-10-04',
  );
  assert.equal(w.days.length, 1);
  assert.equal(w.days[0]!.regularMin, 480);
  assert.equal(w.weekStart, '2026-10-04');
  assert.equal(w.weekEnd, '2026-10-10');
});

test('allocateWorkweek: invalid input throws', () => {
  assert.throws(() => allocateWorkweek([{ workDate: '2026-10-05', minutes: -1 }], C), RangeError);
  assert.throws(() => allocateWorkweek([{ workDate: '2026-10-05', minutes: 1.5 }], C), RangeError);
  assert.throws(() => allocateWorkweek([{ workDate: '10/05/2026', minutes: 60 }], C), RangeError);
  assert.throws(
    () =>
      allocateWorkweek(
        [
          { workDate: '2026-10-01', minutes: 60 },
          { workDate: '2026-10-08', minutes: 60 },
        ],
        C,
      ),
    RangeError,
  );
});

test('allocateWorkweek: bucket totals equal input minutes', () => {
  for (const mins of [[540, 750, 0, 300], [480, 480, 480, 480, 480, 480, 700], [100]]) {
    const w = run(mins);
    const sum = mins.reduce((a, b) => a + b, 0);
    assert.equal(w.totals.regularMin + w.totals.otMin + w.totals.dtMin, sum);
  }
});
