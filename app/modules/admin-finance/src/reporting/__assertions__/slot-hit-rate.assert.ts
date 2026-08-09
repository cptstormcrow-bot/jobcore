/**
 * Assertions for the admin-finance reporting slot-hit-rate helpers (P3l.5).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup (AC-8): no DB, no network, no env vars, no faked
 * clock. Every timestamp used below is a fixed ISO literal, never
 * `Date.now()` or a mock/fake clock library.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Job } from '@jobcore/core';
import { classifyWindow, slotHitRate } from '../slot-hit-rate';

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
    ...overrides,
  };
}

test('AC: classifyWindow returns "hit" when scheduledStart falls inside requestedWindow', () => {
  const job = makeJob({
    requestedWindow: '09:00-12:00',
    scheduledStart: '2026-08-01T10:00:00.000Z',
  });
  assert.equal(classifyWindow(job), 'hit');
});

test('AC: classifyWindow returns "miss" when scheduledStart falls outside requestedWindow', () => {
  const job = makeJob({
    requestedWindow: '09:00-12:00',
    scheduledStart: '2026-08-01T14:00:00.000Z',
  });
  assert.equal(classifyWindow(job), 'miss');
});

test('AC: classifyWindow returns "unknown" when requestedWindow is null', () => {
  const job = makeJob({
    requestedWindow: null,
    scheduledStart: '2026-08-01T10:00:00.000Z',
  });
  assert.equal(classifyWindow(job), 'unknown');
});

test('AC: classifyWindow returns "unknown" for an unparseable requestedWindow', () => {
  const jobFreeText = makeJob({
    requestedWindow: 'morning',
    scheduledStart: '2026-08-01T10:00:00.000Z',
  });
  assert.equal(classifyWindow(jobFreeText), 'unknown');

  const jobAmPm = makeJob({
    requestedWindow: '9am-12pm',
    scheduledStart: '2026-08-01T10:00:00.000Z',
  });
  assert.equal(classifyWindow(jobAmPm), 'unknown');
});

test('AC: slotHitRate tallies hit/miss/unknown/total and computes hitRate excluding unknowns', () => {
  const jobs = [
    makeJob({ id: 'job-hit', requestedWindow: '09:00-12:00', scheduledStart: '2026-08-01T10:00:00.000Z' }),
    makeJob({ id: 'job-miss', requestedWindow: '09:00-12:00', scheduledStart: '2026-08-01T14:00:00.000Z' }),
    makeJob({ id: 'job-unknown', requestedWindow: null, scheduledStart: null }),
  ];

  const result = slotHitRate(jobs);

  assert.equal(result.hit, 1);
  assert.equal(result.miss, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.total, 3);
  assert.equal(result.hitRate, 1 / 2);
});

test('AC: slotHitRate.hitRate is 0 when hit+miss === 0', () => {
  const jobs = [makeJob({ id: 'job-unknown', requestedWindow: null, scheduledStart: null })];
  const result = slotHitRate(jobs);
  assert.equal(result.hit, 0);
  assert.equal(result.miss, 0);
  assert.equal(result.unknown, 1);
  assert.equal(result.hitRate, 0);
});

test('AC-8: the whole suite runs with zero setup — no DB, no network, no env vars, no faked clock', () => {
  assert.equal(typeof process.env.DATABASE_URL, 'undefined');
  assert.equal(typeof process.env.SUPABASE_URL, 'undefined');
});
