/**
 * Assertions for the close-out flow (`completed -> paid` / `paid -> closed` plus its
 * best-effort price-sheet commission write, null when no sheet or rate applies) and its retry wrapper.
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock.
 * Every timestamp used below is a fixed ISO literal, never `Date.now()`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Ctx, Job } from '@jobcore/core';
import { closeOutJob, retryCloseOut, type CloseOutJobDeps } from '../close-out-job';
import type { CompensationPolicy, PriceSheetRate } from '../../money/types';
import type {
  CalendarEventRepository,
  CloseOutFailureRepository,
  CommissionRepository,
  JobRepository,
  PriceSheetRepository,
} from '../../data/ports';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'completed',
    customerId: null,
    serviceId: 'service-1',
    source: null,
    payer: 'insurer',
    attachTiming: 'same_day',
    requestedWindow: null,
    scheduledStart: null,
    scheduledEnd: null,
    address: null,
    description: null,
    assignedTechId: null,
    enRouteAt: null,
    inProgressAt: null,
    completedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    isBeta: false,
    totalLaborSeconds: 0,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<Ctx> = {}): Ctx {
  return {
    role: 'owner',
    now: () => '2026-08-08T12:00:00.000Z',
    ...overrides,
  };
}

const activePriceSheet = {
  id: 'sheet-1',
  organizationId: 'org-1',
  version: 1,
  status: 'published' as const,
  publishedAt: '2026-01-01T00:00:00.000Z',
};

const compensationPolicy: CompensationPolicy = {
  id: 'policy-1',
  organizationId: 'org-1',
  commissionBasisPercent: 10,
  hourlyRate: 0,
};

const matchingRate: PriceSheetRate = {
  id: 'rate-1',
  priceSheetId: 'sheet-1',
  serviceId: 'service-1',
  attachTiming: 'same_day',
  amount: 10000,
};

/** Records every `recordFailure`/`recordAttempt`/`resolve` call for assertion. */
function makeCloseOutFailures(): CloseOutFailureRepository & {
  failures: Array<{ organizationId: string; jobId: string; stage: string; reason: string }>;
  attempts: string[];
  resolutions: Array<{ jobId: string; resolution: string; resolvedBy: string }>;
} {
  const failures: Array<{ organizationId: string; jobId: string; stage: string; reason: string }> = [];
  const attempts: string[] = [];
  const resolutions: Array<{ jobId: string; resolution: string; resolvedBy: string }> = [];
  return {
    failures,
    attempts,
    resolutions,
    async recordFailure(organizationId, jobId, stage, reason) {
      failures.push({ organizationId, jobId, stage, reason });
    },
    async recordAttempt(jobId) {
      attempts.push(jobId);
    },
    async resolve(jobId, resolution, resolvedBy) {
      resolutions.push({ jobId, resolution, resolvedBy });
    },
    async listNeedingAttention() {
      return [];
    },
  };
}

function makeJobs(overrides: Partial<JobRepository> = {}): JobRepository {
  return {
    async listForOrganization() {
      return [];
    },
    async getById() {
      return null;
    },
    async patchScheduling(_jobId, _patch) {
      throw new Error('not implemented');
    },
    async updateDetails(_jobId, _patch) {
      throw new Error('not implemented');
    },
    async closeOutWrite(_jobId, _fromStatus, _commission, _closedByUserId) {
      throw new Error('not implemented');
    },
    async patchLifecycle(_jobId, _patch) {
      throw new Error('not implemented');
    },
    async create() {
      throw new Error('not implemented');
    },
    async updateStatus(_jobId, status) {
      return makeJob({ status });
    },
    async markBeta(_jobId, _isBeta) {},
    async clearInvestigator(_jobId) {},
    async archive(_jobId) {},
    async unarchive(_jobId) {},
    ...overrides,
  };
}

function makeCalendarEvents(overrides: Partial<CalendarEventRepository> = {}): CalendarEventRepository {
  return {
    async create() {},
    async logTransition() {},
    ...overrides,
  };
}

function makePriceSheetRepository(
  overrides: Partial<PriceSheetRepository> = {},
): PriceSheetRepository {
  return {
    async listForOrganization() {
      return [];
    },
    async getActive() {
      return activePriceSheet;
    },
    async create() {
      throw new Error('not implemented');
    },
    ...overrides,
  };
}

function makeCommissionRepository(
  overrides: Partial<CommissionRepository> = {},
): CommissionRepository {
  return {
    async create() {},
    async listForOrganization() {
      return [];
    },
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CloseOutJobDeps> = {}): CloseOutJobDeps {
  return {
    ctx: makeCtx(),
    jobs: makeJobs(),
    calendarEvents: makeCalendarEvents(),
    priceSheetRepository: makePriceSheetRepository(),
    compensationPolicy,
    rates: [matchingRate],
    commissionRepository: makeCommissionRepository(),
    closedByUserId: 'user-1',
    closeOutFailures: makeCloseOutFailures(),
    ...overrides,
  };
}

test('closeOutJob: not-ready hard stop records recordFailure with stage "not_ready"', async () => {
  const closeOutFailures = makeCloseOutFailures();
  const job = makeJob({ status: 'new' });
  const deps = makeDeps({ closeOutFailures });

  const result = await closeOutJob(job, deps);

  assert.equal(result.ok, false);
  assert.equal(closeOutFailures.failures.length, 1);
  assert.equal(closeOutFailures.failures[0]?.stage, 'not_ready');
});

test('closeOutJob: non-awaiting status is rejected with the not-awaiting reason', async () => {
  const result = await closeOutJob(makeJob({ status: 'new' }), makeDeps());

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'Job job-1 is not awaiting close-out (status "new").');
});

test('closeOutJob: paid -> closed calls closeOutWrite with from-status paid and returns a commission', async () => {
  let seenFrom: string | null = null;
  let commissionWrites = 0;
  const deps = makeDeps({
    jobs: makeJobs({
      async closeOutWrite(jobId, fromStatus) {
        commissionWrites += 1;
        seenFrom = fromStatus;
        return makeJob({ id: jobId, status: 'closed' });
      },
    }),
  });

  const result = await closeOutJob(makeJob({ status: 'paid' }), deps);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.job.status, 'closed');
  assert.equal(seenFrom, 'paid');
  assert.equal(commissionWrites, 1);
  assert.ok(result.commission);
});

test('closeOutJob: completed -> paid still passes the real from-status and targets paid', async () => {
  let seenFrom: string | null = null;
  const deps = makeDeps({
    jobs: makeJobs({
      async closeOutWrite(jobId, fromStatus) {
        seenFrom = fromStatus;
        return makeJob({ id: jobId, status: 'paid' });
      },
    }),
  });

  const result = await closeOutJob(makeJob({ status: 'completed' }), deps);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.job.status, 'paid');
  assert.equal(seenFrom, 'completed');
});

test('closeOutJob: a close-out function that leaves a paid job at "paid" is reported as a failed write', async () => {
  const closeOutFailures = makeCloseOutFailures();
  const deps = makeDeps({
    closeOutFailures,
    jobs: makeJobs({
      async closeOutWrite(jobId, _fromStatus, _commission, _closedByUserId) {
        return makeJob({ id: jobId, status: 'paid' });
      },
    }),
  });

  const result = await closeOutJob(makeJob({ status: 'paid' }), deps);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /apply migration 0105/);
  assert.equal(closeOutFailures.failures.length, 1);
  assert.equal(closeOutFailures.failures[0]?.stage, 'write');
  assert.equal(closeOutFailures.resolutions.length, 0);
});

test('closeOutJob: blocked hard stop records recordFailure with stage "blocked"', async () => {
  const closeOutFailures = makeCloseOutFailures();
  // payer === 'customer' with no hasPaymentRecord probe trips
  // requirePaymentSettled's blocker inside closeOutBlockers.
  const job = makeJob({ payer: 'customer' });
  const deps = makeDeps({ closeOutFailures, ctx: makeCtx() });

  const result = await closeOutJob(job, deps);

  assert.equal(result.ok, false);
  assert.equal(closeOutFailures.failures.length, 1);
  assert.equal(closeOutFailures.failures[0]?.stage, 'blocked');
});

test('closeOutJob: no active price sheet is best effort - closes with a null commission and records no failure', async () => {
  const closeOutFailures = makeCloseOutFailures();
  const job = makeJob();
  let writes = 0;
  let seenCommission: unknown = 'unset';
  const deps = makeDeps({
    closeOutFailures,
    priceSheetRepository: makePriceSheetRepository({
      async getActive() {
        return null;
      },
    }),
    jobs: makeJobs({
      async closeOutWrite(jobId, _fromStatus, commission, _closedByUserId) {
        writes += 1;
        seenCommission = commission;
        return makeJob({ id: jobId, status: 'paid' });
      },
    }),
  });

  const result = await closeOutJob(job, deps);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.job.status, 'paid');
  assert.equal(result.commission, null);
  assert.equal(writes, 1);
  assert.equal(seenCommission, null);
  assert.equal(closeOutFailures.failures.length, 0);
});

test('closeOutJob: no matching rate row is best effort - closes with a null commission and records no failure', async () => {
  const closeOutFailures = makeCloseOutFailures();
  const job = makeJob();
  let writes = 0;
  let seenCommission: unknown = 'unset';
  // No rate row matches this job's serviceId/attachTiming, so
  // calculateCommission returns { ok: false } via findMatchingRate.
  const deps = makeDeps({
    closeOutFailures,
    rates: [],
    jobs: makeJobs({
      async closeOutWrite(jobId, _fromStatus, commission, _closedByUserId) {
        writes += 1;
        seenCommission = commission;
        return makeJob({ id: jobId, status: 'paid' });
      },
    }),
  });

  const result = await closeOutJob(job, deps);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.job.status, 'paid');
  assert.equal(result.commission, null);
  assert.equal(writes, 1);
  assert.equal(seenCommission, null);
  assert.equal(closeOutFailures.failures.length, 0);
});

test('closeOutJob: a matching rate row yields a non-null commission that is passed to closeOutWrite', async () => {
  const closeOutFailures = makeCloseOutFailures();
  let seenCommission: unknown = 'unset';
  const deps = makeDeps({
    closeOutFailures,
    jobs: makeJobs({
      async closeOutWrite(jobId, _fromStatus, commission, _closedByUserId) {
        seenCommission = commission;
        return makeJob({ id: jobId, status: 'paid' });
      },
    }),
  });

  const result = await closeOutJob(makeJob(), deps);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.commission);
  assert.notEqual(seenCommission, null);
  assert.deepEqual(seenCommission, result.commission);
  assert.equal(closeOutFailures.failures.length, 0);
});

test('closeOutJob: happy path calls closeOutFailures.resolve with "resolved_retry"', async () => {
  const closeOutFailures = makeCloseOutFailures();
  const job = makeJob();
  const deps = makeDeps({
    closeOutFailures,
    jobs: makeJobs({
      async closeOutWrite(jobId, _fromStatus, _commission, _closedByUserId) {
        return makeJob({ id: jobId, status: 'paid' });
      },
    }),
  });

  const result = await closeOutJob(job, deps);

  assert.equal(result.ok, true);
  assert.equal(closeOutFailures.failures.length, 0);
  assert.equal(closeOutFailures.resolutions.length, 1);
  assert.equal(closeOutFailures.resolutions[0]?.resolution, 'resolved_retry');
  assert.equal(closeOutFailures.resolutions[0]?.jobId, job.id);
});

test('closeOutJob: a thrown error during the final write sequence is caught, recorded with stage "write", and returned as { ok: false }', async () => {
  const closeOutFailures = makeCloseOutFailures();
  const job = makeJob();
  const deps = makeDeps({
    closeOutFailures,
    jobs: makeJobs({
      async closeOutWrite(_jobId, _fromStatus, _commission, _closedByUserId) {
        throw new Error('boom: write failed');
      },
    }),
  });

  const result = await closeOutJob(job, deps);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /boom: write failed/);
  assert.equal(closeOutFailures.failures.length, 1);
  assert.equal(closeOutFailures.failures[0]?.stage, 'write');
  assert.match(closeOutFailures.failures[0]?.reason ?? '', /boom: write failed/);
});

test('retryCloseOut: calls closeOutFailures.recordAttempt then delegates to closeOutJob', async () => {
  const closeOutFailures = makeCloseOutFailures();
  const job = makeJob();
  const deps = makeDeps({
    closeOutFailures,
    jobs: makeJobs({
      async closeOutWrite(jobId, _fromStatus, _commission, _closedByUserId) {
        return makeJob({ id: jobId, status: 'paid' });
      },
    }),
  });

  const result = await retryCloseOut(job, deps);

  assert.equal(closeOutFailures.attempts.length, 1);
  assert.equal(closeOutFailures.attempts[0], job.id);
  assert.equal(result.ok, true);
  assert.equal(closeOutFailures.resolutions.length, 1);
});
