/**
 * Assertions for the Assignment Board pool sort.
 *
 * Runs under `node --experimental-strip-types --test` -- zero dependencies,
 * fixed inline data, no clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { sortPoolJobs } from '../assignment-pool-sort';

interface J {
  id: string;
  scheduledStart?: string | null;
  createdAt?: string | null;
  tech?: boolean;
}

const isAssigned = (j: J) => j.tech === true;

test('pool sort: unassigned jobs come before assigned jobs', () => {
  const jobs: J[] = [
    { id: 'a', scheduledStart: '2026-01-01T00:00:00Z', tech: true },
    { id: 'b', scheduledStart: '2026-02-01T00:00:00Z' },
  ];
  assert.deepEqual(sortPoolJobs(jobs, 'soonest', isAssigned).map((j) => j.id), ['b', 'a']);
  assert.deepEqual(sortPoolJobs(jobs, 'newest', isAssigned).map((j) => j.id), ['b', 'a']);
});

test('pool sort: soonest is ascending, nulls last, ties by createdAt descending', () => {
  const jobs: J[] = [
    { id: 'none', scheduledStart: null },
    { id: 'late', scheduledStart: '2026-03-01T00:00:00Z' },
    { id: 'tieOld', scheduledStart: '2026-02-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'tieNew', scheduledStart: '2026-02-01T00:00:00Z', createdAt: '2026-01-05T00:00:00Z' },
    { id: 'undef' },
  ];
  const ids = sortPoolJobs(jobs, 'soonest', isAssigned).map((j) => j.id);
  assert.deepEqual(ids.slice(0, 3), ['tieNew', 'tieOld', 'late']);
  assert.deepEqual(ids.slice(3).sort(), ['none', 'undef']);
});

test('pool sort: newest is createdAt descending', () => {
  const jobs: J[] = [
    { id: 'old', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'new', createdAt: '2026-01-09T00:00:00Z' },
    { id: 'mid', createdAt: '2026-01-05T00:00:00Z' },
  ];
  assert.deepEqual(sortPoolJobs(jobs, 'newest', isAssigned).map((j) => j.id), ['new', 'mid', 'old']);
});

test('pool sort: the input array is not mutated', () => {
  const jobs: J[] = [
    { id: 'x', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'y', createdAt: '2026-01-09T00:00:00Z' },
  ];
  const before = jobs.map((j) => j.id);
  const out = sortPoolJobs(jobs, 'newest', isAssigned);
  assert.notEqual(out, jobs);
  assert.deepEqual(jobs.map((j) => j.id), before);
});
