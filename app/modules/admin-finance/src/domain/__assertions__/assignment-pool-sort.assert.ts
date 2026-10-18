/**
 * Assertions for the Assignment Board pool sort.
 *
 * Runs under `node --experimental-strip-types --test` -- zero dependencies,
 * fixed inline data, no clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { filterUnassigned, sortPoolJobs } from '../assignment-pool-sort';

interface J {
  id: string;
  scheduledStart?: string | null;
  createdAt?: string | null;
  tech?: boolean;
}

const isAssigned = (j: J) => j.tech === true;

test('pool sort: asc is earliest first, nulls last, ties by createdAt descending', () => {
  const jobs: J[] = [
    { id: 'none', scheduledStart: null },
    { id: 'late', scheduledStart: '2026-03-01T00:00:00Z' },
    { id: 'tieOld', scheduledStart: '2026-02-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'tieNew', scheduledStart: '2026-02-01T00:00:00Z', createdAt: '2026-01-05T00:00:00Z' },
    { id: 'undef' },
  ];
  const ids = sortPoolJobs(jobs, 'asc').map((j) => j.id);
  assert.deepEqual(ids.slice(0, 3), ['tieNew', 'tieOld', 'late']);
  assert.deepEqual(ids.slice(3).sort(), ['none', 'undef']);
});

test('pool sort: desc is latest first, nulls still last', () => {
  const jobs: J[] = [
    { id: 'none', scheduledStart: null },
    { id: 'early', scheduledStart: '2026-01-01T00:00:00Z' },
    { id: 'late', scheduledStart: '2026-03-01T00:00:00Z' },
    { id: 'mid', scheduledStart: '2026-02-01T00:00:00Z' },
    { id: 'bad', scheduledStart: 'not-a-date' },
  ];
  const ids = sortPoolJobs(jobs, 'desc').map((j) => j.id);
  assert.deepEqual(ids.slice(0, 3), ['late', 'mid', 'early']);
  assert.deepEqual(ids.slice(3).sort(), ['bad', 'none']);
});

test('pool sort: the input array is not mutated', () => {
  const jobs: J[] = [
    { id: 'x', scheduledStart: '2026-02-01T00:00:00Z' },
    { id: 'y', scheduledStart: '2026-01-01T00:00:00Z' },
  ];
  const before = jobs.map((j) => j.id);
  const out = sortPoolJobs(jobs, 'asc');
  assert.notEqual(out, jobs);
  assert.deepEqual(jobs.map((j) => j.id), before);
});

test('pool sort: assigned jobs are not grouped', () => {
  const jobs: J[] = [
    { id: 'unassignedLate', scheduledStart: '2026-02-01T00:00:00Z' },
    { id: 'assignedEarly', scheduledStart: '2026-01-01T00:00:00Z', tech: true },
  ];
  assert.deepEqual(sortPoolJobs(jobs, 'asc').map((j) => j.id), ['assignedEarly', 'unassignedLate']);
});

test('filterUnassigned: keeps only unassigned and does not mutate', () => {
  const jobs: J[] = [
    { id: 'a', tech: true },
    { id: 'b' },
    { id: 'c', tech: false },
  ];
  const out = filterUnassigned(jobs, isAssigned);
  assert.deepEqual(out.map((j) => j.id), ['b', 'c']);
  assert.notEqual(out, jobs);
  assert.deepEqual(jobs.map((j) => j.id), ['a', 'b', 'c']);
});
