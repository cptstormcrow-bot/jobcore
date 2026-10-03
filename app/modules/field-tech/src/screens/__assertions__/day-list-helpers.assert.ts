/**
 * Assertions for DayList screen helpers (pure, no side effects, no React).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock
 * (each timestamp used below is a fixed ISO literal, never `Date.now()`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isScheduledOnLocalDate, expandTimeOffToEvents, pickNextJob, listPreviousJobs } from '../day-list-helpers';
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

const NOW = new Date(2026, 8, 10, 12, 0, 0);
const at = (d: number, h = 9) => new Date(2026, 8, d, h, 0, 0).toISOString();

test('pickNextJob: empty -> undefined', () => {
  assert.equal(pickNextJob([], NOW), undefined);
});

test('pickNextJob: earliest future wins', () => {
  const a = makeJob({ id: 'a', scheduledStart: at(15) });
  const b = makeJob({ id: 'b', scheduledStart: at(12) });
  assert.equal(pickNextJob([a, b], NOW)?.id, 'b');
});

test('pickNextJob: ignores closed statuses', () => {
  const jobs = (['completed', 'paid', 'closed', 'cancelled'] as const).map((s, i) =>
    makeJob({ id: `c${i}`, status: s as Job['status'], scheduledStart: at(11) }),
  );
  assert.equal(pickNextJob(jobs, NOW), undefined);
});

test('pickNextJob: ignores null scheduledStart', () => {
  assert.equal(pickNextJob([makeJob({ scheduledStart: null })], NOW), undefined);
});

test('pickNextJob: includes open job earlier today', () => {
  const j = makeJob({ id: 'today', scheduledStart: at(10, 6) });
  assert.equal(pickNextJob([j], NOW)?.id, 'today');
});

test('pickNextJob: ignores yesterday open job', () => {
  assert.equal(pickNextJob([makeJob({ scheduledStart: at(9, 18) })], NOW), undefined);
});

test('pickNextJob: stable ties', () => {
  const a = makeJob({ id: 'first', scheduledStart: at(12) });
  const b = makeJob({ id: 'second', scheduledStart: at(12) });
  assert.equal(pickNextJob([a, b], NOW)?.id, 'first');
});

test('listPreviousJobs: only completed/paid/closed', () => {
  const jobs = [
    makeJob({ id: 'x', status: 'scheduled' as Job['status'], scheduledStart: at(1) }),
    makeJob({ id: 'c', status: 'completed' as Job['status'], scheduledStart: at(2) }),
    makeJob({ id: 'p', status: 'paid' as Job['status'], scheduledStart: at(3) }),
    makeJob({ id: 'z', status: 'closed' as Job['status'], scheduledStart: at(4) }),
  ];
  assert.deepEqual(listPreviousJobs(jobs).map((j) => j.id).sort(), ['c', 'p', 'z']);
});

test('listPreviousJobs: newest first, undated last', () => {
  const jobs = [
    makeJob({ id: 'none', status: 'completed' as Job['status'] }),
    makeJob({ id: 'old', status: 'completed' as Job['status'], completedAt: at(1) }),
    makeJob({ id: 'new', status: 'completed' as Job['status'], completedAt: at(5) }),
    makeJob({ id: 'sched', status: 'paid' as Job['status'], scheduledStart: at(3) }),
  ];
  assert.deepEqual(listPreviousJobs(jobs).map((j) => j.id), ['new', 'sched', 'old', 'none']);
});

test('listPreviousJobs: capped at 10 of 12, custom limit', () => {
  const jobs = Array.from({ length: 12 }, (_, i) =>
    makeJob({ id: `j${i}`, status: 'completed' as Job['status'], completedAt: at(i + 1) }),
  );
  assert.equal(listPreviousJobs(jobs).length, 10);
  assert.equal(listPreviousJobs(jobs, 3).length, 3);
});
