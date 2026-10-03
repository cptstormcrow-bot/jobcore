/**
 * Assertions for `bucketHours`.
 *
 * Runs under `node --experimental-strip-types --test` — zero setup: no DB,
 * no network, no env vars; `now` is a fixed injected Date.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { bucketHours } from '../hoursBuckets';

// Thu 15 Oct 2026 local; week starts Sun 11 Oct.
const NOW = new Date(2026, 9, 15, 12, 0, 0);

function entry(inAt: Date, hours: number | null) {
  return {
    id: 'e1',
    organizationId: 'org-1',
    jobId: 'job-1',
    techId: 'tech-1',
    clockInAt: inAt.toISOString(),
    clockOutAt: hours === null ? null : new Date(inAt.getTime() + hours * 3_600_000).toISOString(),
    createdAt: inAt.toISOString(),
  };
}

test('entry in the current week counts in week, month and year', () => {
  const r = bucketHours([entry(new Date(2026, 9, 13, 8, 0, 0), 2)], NOW);
  assert.deepEqual(r, { week: 2, month: 2, year: 2 });
});

test('entry earlier this month but before the week start counts in month and year only', () => {
  const r = bucketHours([entry(new Date(2026, 9, 2, 8, 0, 0), 3)], NOW);
  assert.deepEqual(r, { week: 0, month: 3, year: 3 });
});

test('entry earlier this year but before this month counts in year only', () => {
  const r = bucketHours([entry(new Date(2026, 2, 3, 8, 0, 0), 4)], NOW);
  assert.deepEqual(r, { week: 0, month: 0, year: 4 });
});

test('entry in the prior year counts in none', () => {
  const r = bucketHours([entry(new Date(2025, 11, 30, 8, 0, 0), 4)], NOW);
  assert.deepEqual(r, { week: 0, month: 0, year: 0 });
});

test('open entry is ignored', () => {
  const r = bucketHours([entry(new Date(2026, 9, 13, 8, 0, 0), null)], NOW);
  assert.deepEqual(r, { week: 0, month: 0, year: 0 });
});

test('zero or negative duration is ignored', () => {
  const r = bucketHours(
    [entry(new Date(2026, 9, 13, 8, 0, 0), 0), entry(new Date(2026, 9, 13, 9, 0, 0), -2)],
    NOW,
  );
  assert.deepEqual(r, { week: 0, month: 0, year: 0 });
});

test('empty array yields zeros', () => {
  assert.deepEqual(bucketHours([], NOW), { week: 0, month: 0, year: 0 });
});
