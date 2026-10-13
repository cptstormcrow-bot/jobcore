import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  dayOfWeek,
  parseIsoDate,
  weekDates,
  weekEndOf,
  weekIndexFromAnchor,
  weekStartOf,
} from '../periods.js';

const SUN = { weekStartDow: 0, anchorDate: '2026-10-11' };
const MON = { weekStartDow: 1, anchorDate: '2026-10-12' };

test('dayOfWeek: known dates', () => {
  assert.equal(dayOfWeek('2026-10-12'), 1);
  assert.equal(dayOfWeek('2026-10-11'), 0);
  assert.equal(dayOfWeek('2028-02-29'), 2);
});

test('weekStartOf: Sunday start', () => {
  assert.equal(weekStartOf('2026-10-14', SUN), '2026-10-11');
  assert.equal(weekStartOf('2026-10-11', SUN), '2026-10-11');
  assert.equal(weekStartOf('2026-10-17', SUN), '2026-10-11');
});

test('weekStartOf: Monday start', () => {
  assert.equal(weekStartOf('2026-10-14', MON), '2026-10-12');
  assert.equal(weekStartOf('2026-10-11', MON), '2026-10-05');
});

test('weekStartOf: year boundary', () => {
  assert.equal(weekStartOf('2026-01-01', SUN), '2025-12-28');
  assert.equal(weekStartOf('2026-01-01', MON), '2025-12-29');
});

test('weekEndOf: Sunday start', () => {
  assert.equal(weekEndOf('2026-10-14', SUN), '2026-10-17');
});

test('addDays: month, year, negative, leap day', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-02-28', 2), '2028-03-01');
});

test('weekDates: seven consecutive dates', () => {
  assert.deepEqual(weekDates('2026-10-11'), [
    '2026-10-11',
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
  ]);
});

test('weekIndexFromAnchor: Monday anchor', () => {
  assert.equal(weekIndexFromAnchor('2026-10-12', MON), 0);
  assert.equal(weekIndexFromAnchor('2026-10-19', MON), 1);
  assert.equal(weekIndexFromAnchor('2026-10-11', MON), -1);
  assert.equal(weekIndexFromAnchor('2026-10-26', MON), 2);
});

test('rejects bad input', () => {
  assert.throws(() => parseIsoDate('2026-02-30'), RangeError);
  assert.throws(() => parseIsoDate('not-a-date'), RangeError);
  assert.throws(() => weekStartOf('2026-10-14', { ...SUN, weekStartDow: 7 }), RangeError);
  assert.throws(() => weekStartOf('2026-10-14', { ...SUN, weekStartDow: 1.5 }), RangeError);
});
