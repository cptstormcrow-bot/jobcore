/**
 * Assertions for `overview-helpers.ts` — the Field Tech Overview tile counts.
 *
 * Runs under `node --experimental-strip-types --test` — zero new dependencies,
 * zero setup: no DB, no network, no env vars, no faked clock. Every input is a
 * fixed literal, so each expected count is checkable by hand.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CLOSED_JOB_STATUSES, EMPTY_COUNTS, computeOverviewCounts } from '../overview-helpers';
import type { OverviewCountInputs } from '../overview-helpers';
import type { Job } from '@jobcore/core';

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

function makeInputs(overrides: Partial<OverviewCountInputs> = {}): OverviewCountInputs {
  return {
    jobs: [],
    timeOff: [],
    reimbursements: [],
    notesPerJob: [],
    photosPerJob: [],
    checklistPerJob: [],
    ...overrides,
  };
}

test('empty inputs produce EMPTY_COUNTS (every tile zero)', () => {
  assert.deepEqual(computeOverviewCounts(makeInputs()), EMPTY_COUNTS);
  for (const value of Object.values(EMPTY_COUNTS)) assert.equal(value, 0);
});

test('closed set is exactly completed / paid / closed / declined / cancelled', () => {
  assert.deepEqual([...CLOSED_JOB_STATUSES].sort(), ['cancelled', 'closed', 'completed', 'declined', 'paid']);
});

test('assignedJobs counts every job; openJobs excludes every closed status', () => {
  const open = makeJob({ id: 'open-1' });
  assert.equal(CLOSED_JOB_STATUSES.has(open.status), false, 'factory default status must be an open status');
  const closed = [...CLOSED_JOB_STATUSES].map((status, i) => makeJob({ id: `closed-${i}`, status }));
  const counts = computeOverviewCounts(makeInputs({ jobs: [open, makeJob({ id: 'open-2' }), ...closed] }));
  assert.equal(counts.assignedJobs, 2 + CLOSED_JOB_STATUSES.size);
  assert.equal(counts.openJobs, 2);
});

test('time off counts pending and approved; other statuses are ignored', () => {
  const counts = computeOverviewCounts(
    makeInputs({ timeOff: [{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }, { status: 'denied' }] }),
  );
  assert.equal(counts.timeOffPending, 2);
  assert.equal(counts.timeOffApproved, 1);
});

test('reimbursements count pending, approved and rejected separately', () => {
  const counts = computeOverviewCounts(
    makeInputs({
      reimbursements: [
        { status: 'pending' },
        { status: 'approved' },
        { status: 'approved' },
        { status: 'rejected' },
        { status: 'rejected' },
        { status: 'rejected' },
        { status: 'paid' },
      ],
    }),
  );
  assert.equal(counts.reimbursementsPending, 1);
  assert.equal(counts.reimbursementsApproved, 2);
  assert.equal(counts.reimbursementsRejected, 3);
});

test('notes and photos sum across jobs', () => {
  const counts = computeOverviewCounts(makeInputs({ notesPerJob: [3, 0, 2], photosPerJob: [1, 4, 0] }));
  assert.equal(counts.jobNotes, 5);
  assert.equal(counts.jobPhotos, 5);
});

test('checklist tuples sum open and submitted independently', () => {
  const counts = computeOverviewCounts(makeInputs({ checklistPerJob: [[2, 1], [0, 3], [1, 0]] }));
  assert.equal(counts.checklistOpen, 3);
  assert.equal(counts.checklistSubmitted, 4);
});
