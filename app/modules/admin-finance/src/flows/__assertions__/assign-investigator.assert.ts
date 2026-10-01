/**
 * Assertions for the assign-investigator flow: assigning REPLACES the job's
 * existing Prem row (clear, then create) and surfaces failures from either step.
 *
 * Runs under `node --experimental-strip-types --test` — no DB, no network,
 * fixed ISO timestamps only.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Ctx, Job } from '@jobcore/core';
import { assignInvestigator, type AssignInvestigatorDeps } from '../assign-investigator';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'scheduled',
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
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    isBeta: false,
    totalLaborSeconds: 0,
    ...overrides,
  };
}

const ctx: Ctx = { role: 'owner', now: () => '2026-08-08T12:00:00.000Z' };

function makeDeps(opts: { clearError?: Error; createError?: Error } = {}) {
  const calls: string[] = [];
  const created: unknown[] = [];
  const deps = {
    ctx,
    jobs: {
      clearInvestigator: async (_jobId: string) => {
        calls.push('clear');
        if (opts.clearError) throw opts.clearError;
      },
    },
    assignments: {
      create: async (_orgId: string, draft: unknown) => {
        calls.push('create');
        created.push(draft);
        if (opts.createError) throw opts.createError;
        return draft;
      },
    },
  } as unknown as AssignInvestigatorDeps;
  return { deps, calls, created };
}

test('assignInvestigator clears the old Prem row, then creates the new one', async () => {
  const { deps, calls, created } = makeDeps();
  const job = makeJob();
  const result = await assignInvestigator(job, 'tech-9', deps);
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['clear', 'create']);
  const draft = created[0] as { kind: string; jobId: string; techId: string };
  assert.equal(draft.kind, 'investigator');
  assert.equal(draft.jobId, 'job-1');
  assert.equal(draft.techId, 'tech-9');
});

test('assignInvestigator returns the error and skips create when clear throws', async () => {
  const { deps, calls } = makeDeps({ clearError: new Error('boom') });
  const result = await assignInvestigator(makeJob(), 'tech-9', deps);
  assert.deepEqual(result, { ok: false, reason: 'boom' });
  assert.deepEqual(calls, ['clear']);
});

test('assignInvestigator returns the error message when create throws', async () => {
  const { deps } = makeDeps({ createError: new Error('insert failed') });
  const result = await assignInvestigator(makeJob(), 'tech-9', deps);
  assert.deepEqual(result, { ok: false, reason: 'insert failed' });
});
