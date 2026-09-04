/**
 * Assertions for DayList screen helpers (pure, no side effects, no React).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock
 * (each timestamp used below is a fixed ISO literal, never `Date.now()`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isScheduledOnLocalDate, expandTimeOffToEvents } from '../DayList';
import type { Job } from '@jobcore/core';
import type { TimeOffRequest, TimeOffStatus } from '../../data/ports';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    jobNumber: 1,
    organizationId: 'org-1',
    status: 'scheduled' as Job['status'],
    customerId: null,
    serviceId: null,
    source: null,
    payer: null,
    attachTiming: null,
    requestedWindow: null,
    scheduledStart: null,
    scheduledEnd: null,
    address: null,
    description: null,
    assignedTechId: null,
    enRouteAt: null,
    inProgressAt: null,
    completedAt: null,
    createdAt: '2026-09-04T00:00:00.000Z',
    ...overrides,
  } as Job;
}

function makeRequest(overrides: Partial<TimeOffRequest> = {}): TimeOffRequest {
  return {
    id: 'req-1',
    organizationId: 'org-1',
    techId: 'tech-1',
    startDate: '2026-09-04',
    endDate: '2026-09-04',
    reason: null,
    status: 'pending' as TimeOffStatus,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    createdByAdminId: null,
    ...overrides,
  };
}

// --- isScheduledOnLocalDate ---

test('isScheduledOnLocalDate: a job at 23:30 local today IS today', () => {
  const today = new Date(2026, 8, 4, 12, 0, 0); // local: Sep 4 2026, noon
  const job = makeJob({ scheduledStart: new Date(2026, 8, 4, 23, 30, 0).toISOString() });
  assert.equal(isScheduledOnLocalDate(job, today), true);
});

test('isScheduledOnLocalDate: a job at 00:30 local tomorrow is NOT today', () => {
  const today = new Date(2026, 8, 4, 12, 0, 0);
  const job = makeJob({ scheduledStart: new Date(2026, 8, 5, 0, 30, 0).toISOString() });
  assert.equal(isScheduledOnLocalDate(job, today), false);
});

test('isScheduledOnLocalDate: returns false when scheduledStart is null', () => {
  const today = new Date(2026, 8, 4, 12, 0, 0);
  assert.equal(isScheduledOnLocalDate(makeJob({ scheduledStart: null }), today), false);
});

test('isScheduledOnLocalDate: returns false for an unparseable scheduledStart', () => {
  const today = new Date(2026, 8, 4, 12, 0, 0);
  assert.equal(isScheduledOnLocalDate(makeJob({ scheduledStart: 'not-a-date' }), today), false);
});

// --- expandTimeOffToEvents ---

test('expandTimeOffToEvents: excludes cancelled requests', () => {
  const requests = [makeRequest({ status: 'cancelled' })];
  assert.deepEqual(expandTimeOffToEvents(requests), []);
});

test('expandTimeOffToEvents: excludes denied requests', () => {
  const requests = [makeRequest({ status: 'denied' })];
  assert.deepEqual(expandTimeOffToEvents(requests), []);
});

test('expandTimeOffToEvents: includes pending and approved requests', () => {
  const requests = [
    makeRequest({ id: 'req-pending', status: 'pending', startDate: '2026-09-04', endDate: '2026-09-04' }),
    makeRequest({ id: 'req-approved', status: 'approved', startDate: '2026-09-05', endDate: '2026-09-05' }),
  ];
  const events = expandTimeOffToEvents(requests);
  assert.equal(events.length, 2);
  assert.ok(events.some((e) => e.id.startsWith('req-pending-')));
  assert.ok(events.some((e) => e.id.startsWith('req-approved-')));
});

test('expandTimeOffToEvents: a multi-day request expands to one event per day', () => {
  const requests = [makeRequest({ id: 'req-multi', startDate: '2026-09-04', endDate: '2026-09-06' })];
  const events = expandTimeOffToEvents(requests);
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((e) => e.id),
    ['req-multi-2026-09-04', 'req-multi-2026-09-05', 'req-multi-2026-09-06'],
  );
});

test('expandTimeOffToEvents: a single-day request expands to exactly one event', () => {
  const requests = [makeRequest({ id: 'req-single', startDate: '2026-09-04', endDate: '2026-09-04' })];
  const events = expandTimeOffToEvents(requests);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.id, 'req-single-2026-09-04');
});

test('expandTimeOffToEvents: skips requests with unparseable dates', () => {
  const requests = [makeRequest({ startDate: 'bad-date', endDate: 'bad-date' })];
  assert.deepEqual(expandTimeOffToEvents(requests), []);
});
