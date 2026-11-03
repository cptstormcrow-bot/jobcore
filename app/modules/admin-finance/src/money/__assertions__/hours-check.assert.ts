/**
 * Assertions for the payroll hours check (hours-check.ts).
 *
 * Runs under `node --experimental-strip-types --test` — no DB, network, env
 * vars or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { compareHours } from '../hours-check';

test('hours check: diff is entered minus job plus travel', () => {
  const [r] = compareHours([{ userId: 'a', name: 'Ann', minutes: 480 }], [{ userId: 'a', jobMin: 400, travelMin: 50 }]);
  assert.deepEqual(r, { userId: 'a', name: 'Ann', enteredMin: 480, jobMin: 400, travelMin: 50, systemMin: 450, diffMin: 30 });
});

test('hours check: a tech on only one side still gets a row', () => {
  const rows = compareHours([{ userId: 'a', name: 'Ann', minutes: 60 }], [{ userId: 'b', jobMin: 120, travelMin: 0 }], { b: 'Bob' });
  assert.deepEqual(rows.map((r) => `${r.name}:${r.diffMin}`), ['Bob:-120', 'Ann:60']);
});

test('hours check: entries for the same tech add up', () => {
  const [r] = compareHours(
    [
      { userId: 'a', name: 'Ann', minutes: 240 },
      { userId: 'a', name: 'Ann', minutes: 240 },
    ],
    [],
  );
  assert.equal(r?.enteredMin, 480);
  assert.equal(r?.systemMin, 0);
});

test('hours check: matching hours give a zero diff, sorted after real gaps', () => {
  const rows = compareHours(
    [
      { userId: 'a', name: 'Ann', minutes: 60 },
      { userId: 'b', name: 'Bob', minutes: 90 },
    ],
    [
      { userId: 'a', jobMin: 60, travelMin: 0 },
      { userId: 'b', jobMin: 60, travelMin: 0 },
    ],
  );
  assert.deepEqual(rows.map((r) => `${r.name}:${r.diffMin}`), ['Bob:30', 'Ann:0']);
});

test('hours check: empty in gives empty out', () => {
  assert.deepEqual(compareHours([], []), []);
});
