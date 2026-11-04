import test from 'node:test';
import assert from 'node:assert/strict';

import { makeWarmGate, payWeekRange, warmRanges } from './warm-cache-plan';

test('pay week starts on the set day and runs 7 days', () => {
  // Wednesday 2026-11-04, weeks start Monday.
  assert.deepEqual(payWeekRange(new Date(2026, 10, 4), 1, 0), { from: '2026-11-02', to: '2026-11-08' });
  // Weeks start Sunday.
  assert.deepEqual(payWeekRange(new Date(2026, 10, 4), 0, 0), { from: '2026-11-01', to: '2026-11-07' });
  // On the start day itself, that day begins the week.
  assert.deepEqual(payWeekRange(new Date(2026, 10, 2), 1, 0), { from: '2026-11-02', to: '2026-11-08' });
});

test('fills this week and last week', () => {
  assert.deepEqual(warmRanges(new Date(2026, 10, 4), 1), [
    { from: '2026-11-02', to: '2026-11-08' },
    { from: '2026-10-26', to: '2026-11-01' },
  ]);
});

test('the gate lets one fill through per wait', () => {
  let t = 0;
  const gate = makeWarmGate(1000, () => t);
  assert.equal(gate(), true);
  t = 500;
  assert.equal(gate(), false);
  t = 1000;
  assert.equal(gate(), true);
});
