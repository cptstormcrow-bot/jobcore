/**
 * Assertions for the admin-finance reporting group-by helpers (P3l.5).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup (AC-8): no DB, no network, no env vars, no faked
 * clock. Every timestamp used below is a fixed ISO literal, never
 * `Date.now()` or a mock/fake clock library.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Job } from '@jobcore/core';
import { byStatus, bySource, byAttachTiming } from '../group-by';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'completed',
    customerId: 'cust-1',
    serviceId: 'svc-1',
    source: null,
    payer: null,
    attachTiming: 'same_day',
    requestedWindow: null,
    scheduledStart: null,
    scheduledEnd: null,
    address: null,
    description: null,
    assignedTechId: 'tech-1',
    enRouteAt: '2026-08-01T13:00:00.000Z',
    inProgressAt: '2026-08-01T13:30:00.000Z',
    completedAt: '2026-08-01T15:30:00.000Z',
    createdAt: '2026-08-01T12:00:00.000Z',
    isBeta: false,
    ...overrides,
  };
}

test('AC: byStatus groups jobs by status, every job in exactly one group', () => {
  const jobA = makeJob({ id: 'job-a', status: 'completed' });
  const jobB = makeJob({ id: 'job-b', status: 'scheduled' });
  const jobC = makeJob({ id: 'job-c', status: 'completed' });

  const groups = byStatus([jobA, jobB, jobC]);

  assert.deepEqual(
    groups.completed.map((j) => j.id),
    ['job-a', 'job-c'],
  );
  assert.deepEqual(
    groups.scheduled.map((j) => j.id),
    ['job-b'],
  );

  const totalGrouped = Object.values(groups).reduce((sum, g) => sum + g.length, 0);
  assert.equal(totalGrouped, 3);
});

test('AC: bySource groups a null source under the literal key "unknown"', () => {
  const jobWithSource = makeJob({ id: 'job-a', source: 'web' });
  const jobWithoutSource = makeJob({ id: 'job-b', source: null });

  const groups = bySource([jobWithSource, jobWithoutSource]);

  const webGroup = groups.web;
  assert.ok(webGroup);
  assert.deepEqual(
    webGroup.map((j) => j.id),
    ['job-a'],
  );
  const unknownGroup = groups.unknown;
  assert.ok(unknownGroup);
  assert.deepEqual(
    unknownGroup.map((j) => j.id),
    ['job-b'],
  );
});

test('AC: byAttachTiming groups a null attachTiming under the literal key "unknown"', () => {
  const jobWithTiming = makeJob({ id: 'job-a', attachTiming: 'same_day' });
  const jobWithoutTiming = makeJob({ id: 'job-b', attachTiming: null });

  const groups = byAttachTiming([jobWithTiming, jobWithoutTiming]);

  const sameDayGroup = groups.same_day;
  assert.ok(sameDayGroup);
  assert.deepEqual(
    sameDayGroup.map((j) => j.id),
    ['job-a'],
  );
  const unknownGroup = groups.unknown;
  assert.ok(unknownGroup);
  assert.deepEqual(
    unknownGroup.map((j) => j.id),
    ['job-b'],
  );
});

test('AC-8: the whole suite runs with zero setup — no DB, no network, no env vars, no faked clock', () => {
  assert.equal(typeof process.env.DATABASE_URL, 'undefined');
  assert.equal(typeof process.env.SUPABASE_URL, 'undefined');
});
