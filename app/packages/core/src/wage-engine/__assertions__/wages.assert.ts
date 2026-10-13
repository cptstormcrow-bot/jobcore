import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildRunLine, grossCentsForSegments, segmentsFromDays } from '../wages.js';

const seg = (hourlyRateCents: number, regularMin: number, otMin = 0, dtMin = 0) => ({
  hourlyRateCents,
  regularMin,
  otMin,
  dtMin,
});

const day = (workDate: string, regularMin: number, otMin = 0, dtMin = 0) => ({
  workDate,
  regularMin,
  otMin,
  dtMin,
  seventhDay: false,
});

test('gross: 8h regular at 2500c -> 20000', () => {
  assert.equal(grossCentsForSegments([seg(2500, 480)]), 20000);
});

test('gross: 9h day (8 reg + 1 ot) at 2500c -> 23750', () => {
  assert.equal(grossCentsForSegments([seg(2500, 480, 60)]), 23750);
});

test('gross: 12.5h day (8 reg, 4 ot, 0.5 dt) at 2500c -> 37500', () => {
  assert.equal(grossCentsForSegments([seg(2500, 480, 240, 30)]), 37500);
});

test('gross: rounds half up (83.5 -> 84)', () => {
  assert.equal(grossCentsForSegments([seg(2505, 2)]), 84);
});

test('gross: rounds once per line, not per segment', () => {
  // Each segment alone is 33.3 cents (rounds to 33); together 66.67 -> 67, not 33+33=66.
  assert.equal(grossCentsForSegments([seg(1999, 1), seg(2001, 1)]), 67);
});

test('gross: empty segments -> 0', () => {
  assert.equal(grossCentsForSegments([]), 0);
});

test('gross: rejects negative or fractional values', () => {
  assert.throws(() => grossCentsForSegments([seg(2500, -1)]), RangeError);
  assert.throws(() => grossCentsForSegments([seg(2500.5, 1)]), RangeError);
});

test('buildRunLine: mid-week rate change', () => {
  const history = [
    { effectiveFrom: '2026-01-01', hourlyRateCents: 2500 },
    { effectiveFrom: '2026-10-14', hourlyRateCents: 3000 },
  ];
  const days = [
    day('2026-10-12', 480),
    day('2026-10-13', 480),
    day('2026-10-14', 480),
    day('2026-10-15', 480),
    day('2026-10-16', 480),
  ];
  const line = buildRunLine({
    userId: 'u1',
    employeeName: 'Pat',
    days,
    rateHistory: history,
    reimbursementCents: 4550,
  });
  assert.deepEqual(line.segments, [seg(2500, 960), seg(3000, 1440)]);
  assert.equal(line.regularMin, 2400);
  assert.equal(line.grossCents, 112000);
  assert.equal(line.totalCents, 116550);
  assert.equal(line.userId, 'u1');
  assert.equal(line.employeeName, 'Pat');
});

test('segmentsFromDays: non-contiguous same-rate days merge', () => {
  const history = [
    { effectiveFrom: '2026-01-01', hourlyRateCents: 2500 },
    { effectiveFrom: '2026-10-13', hourlyRateCents: 3000 },
    { effectiveFrom: '2026-10-14', hourlyRateCents: 2500 },
  ];
  const days = [day('2026-10-12', 60), day('2026-10-13', 60), day('2026-10-14', 60)];
  assert.deepEqual(segmentsFromDays(days, history), [seg(2500, 120), seg(3000, 60)]);
});

test('segmentsFromDays: no rate in force throws, fallback used when given', () => {
  const days = [day('2026-10-12', 60)];
  assert.throws(() => segmentsFromDays(days, []), RangeError);
  const late = [{ effectiveFrom: '2026-10-13', hourlyRateCents: 2500 }];
  assert.throws(() => segmentsFromDays(days, late), /2026-10-12/);
  const line = buildRunLine({
    userId: 'u',
    employeeName: 'n',
    days,
    rateHistory: [],
    fallbackRateCents: 2000,
  });
  assert.equal(line.grossCents, 2000);
});

test('segmentsFromDays: inputs not mutated, unsorted equals sorted', () => {
  const history = [
    { effectiveFrom: '2026-10-13', hourlyRateCents: 3000 },
    { effectiveFrom: '2026-01-01', hourlyRateCents: 2500 },
  ];
  const unsorted = [day('2026-10-14', 60), day('2026-10-12', 30), day('2026-10-13', 45)];
  const sorted = [day('2026-10-12', 30), day('2026-10-13', 45), day('2026-10-14', 60)];
  const before = JSON.stringify([unsorted, history]);
  const a = segmentsFromDays(unsorted, history);
  assert.equal(JSON.stringify([unsorted, history]), before);
  assert.deepEqual(a, segmentsFromDays(sorted, history));
});

test('buildRunLine: negative reimbursement throws', () => {
  assert.throws(
    () =>
      buildRunLine({
        userId: 'u',
        employeeName: 'n',
        days: [],
        rateHistory: [],
        reimbursementCents: -1,
      }),
    RangeError,
  );
});
