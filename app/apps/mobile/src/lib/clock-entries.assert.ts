import test from 'node:test';
import assert from 'node:assert/strict';

import { clockDraftsFromSegments, localIsoDate } from './clock-entries';

const range = { from: '2026-11-02', to: '2026-11-08' };
const at = (h: number, m = 0) => new Date(2026, 10, 3, h, m).toISOString();

test('a finished job session becomes a draft with its job number', () => {
  const d = clockDraftsFromSegments(
    [{ id: 's1', reason_code: 'job_labor', started_at: at(8), ended_at: at(10, 30), jobs: { job_number: 1042 } }],
    new Set(),
    range,
  );
  assert.deepEqual(d, [
    { id: 's1', workDate: '2026-11-03', minutes: 150, clockInAt: at(8), clockOutAt: at(10, 30), notes: 'Job #1042 clock' },
  ]);
});

test('travel is labeled travel', () => {
  const d = clockDraftsFromSegments([{ id: 't', reason_code: 'travel', started_at: at(7), ended_at: at(7, 20) }], new Set(), range);
  assert.equal(d[0]!.notes, 'Job travel');
  assert.equal(d[0]!.minutes, 20);
});

test('already imported, still open, zero, too long, other reasons and out of range are skipped', () => {
  const d = clockDraftsFromSegments(
    [
      { id: 'seen', reason_code: 'job_labor', started_at: at(8), ended_at: at(9) },
      { id: 'open', reason_code: 'job_labor', started_at: at(8), ended_at: null },
      { id: 'zero', reason_code: 'job_labor', started_at: at(8), ended_at: at(8) },
      { id: 'long', reason_code: 'job_labor', started_at: new Date(2026, 10, 3).toISOString(), ended_at: new Date(2026, 10, 4, 1).toISOString() },
      { id: 'break', reason_code: 'break', started_at: at(8), ended_at: at(9) },
      { id: 'old', reason_code: 'job_labor', started_at: new Date(2026, 9, 30, 8).toISOString(), ended_at: new Date(2026, 9, 30, 9).toISOString() },
    ],
    new Set(['seen']),
    range,
  );
  assert.deepEqual(d, []);
});

test('localIsoDate uses the device day', () => {
  assert.equal(localIsoDate(new Date(2026, 0, 5, 23, 59).toISOString()), '2026-01-05');
});
