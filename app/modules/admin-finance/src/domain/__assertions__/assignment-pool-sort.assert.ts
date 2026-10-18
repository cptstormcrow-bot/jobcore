/**
 * Assertions for the Assignment Board pool sort.
 *
 * Runs under `node --experimental-strip-types --test` -- zero dependencies,
 * fixed inline data, no clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { sortPoolJobs, unassignedFirst } from '../assignment-pool-sort';

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

test('unassignedFirst: unassigned ahead of assigned, order kept within each group, input not mutated', () => {
  const jobs: J[] = [
    { id: 'a', tech: true },
    { id: 'b' },
    { id: 'c', tech: false },
    { id: 'd', tech: true },
  ];
  const out = unassignedFirst(jobs, isAssigned);
  assert.deepEqual(out.map((j) => j.id), ['b', 'c', 'a', 'd']);
  assert.notEqual(out, jobs);
  assert.deepEqual(jobs.map((j) => j.id), ['a', 'b', 'c', 'd']);
});

test('unassignedFirst after sortPoolJobs desc keeps date order per group and nulls last', () => {
  const jobs: J[] = [
    { id: 'aLate', scheduledStart: '2026-03-01T00:00:00Z', tech: true },
    { id: 'uMid', scheduledStart: '2026-02-01T00:00:00Z' },
    { id: 'uEarly', scheduledStart: '2026-01-01T00:00:00Z' },
    { id: 'aNone', scheduledStart: null, tech: true },
    { id: 'uNone', scheduledStart: null },
  ];
  const ids = unassignedFirst(sortPoolJobs(jobs, 'desc'), isAssigned).map((j) => j.id);
  assert.deepEqual(ids, ['uMid', 'uEarly', 'uNone', 'aLate', 'aNone']);
});
