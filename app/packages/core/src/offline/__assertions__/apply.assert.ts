import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyOptimistic } from '../apply';
import type { Ctx, Job } from '../../index';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'new',
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
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCtx(overrides: Partial<Ctx> = {}): Ctx {
  return {
    role: 'owner',
    now: () => '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('applyOptimistic: applies the transition and returns the transitioned job plus a queue row', async () => {
  const job = makeJob({ status: 'new' });
  const ctx = makeCtx({ now: () => '2026-01-05T00:00:00.000Z' });

  const result = await applyOptimistic(job, 'qualified', ctx, { nonce: 'nonce-1' });

  assert.equal(result.job.status, 'qualified');
  assert.equal(result.mutation.op, 'job.transition.qualified');
  assert.equal(result.mutation.occurredAt, '2026-01-05T00:00:00.000Z');
  assert.equal(
    result.mutation.id,
    'job.transition.qualified:2026-01-05T00:00:00.000Z:nonce-1'
  );
  const payload = JSON.parse(result.mutation.payload);
  assert.equal(payload.jobId, 'job-1');
  assert.equal(payload.from, 'new');
  assert.equal(payload.to, 'qualified');
});

test('applyOptimistic: calls the enqueue sink with the built mutation when supplied', async () => {
  const calls: unknown[] = [];
  const job = makeJob({ status: 'new' });
  const ctx = makeCtx();

  const result = await applyOptimistic(job, 'qualified', ctx, {
    nonce: 'nonce-2',
    enqueue: (mutation) => {
      calls.push(mutation);
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], result.mutation);
});

test('applyOptimistic: computes but does not persist when no enqueue sink is supplied', async () => {
  const job = makeJob({ status: 'new' });
  const result = await applyOptimistic(job, 'qualified', makeCtx(), { nonce: 'nonce-3' });
  assert.equal(result.job.status, 'qualified');
  assert.ok(result.mutation.id.length > 0);
});

test('applyOptimistic: an illegal transition throws before anything is queued', async () => {
  const calls: unknown[] = [];
  const job = makeJob({ status: 'new' });
  const ctx = makeCtx();

  await assert.rejects(
    () =>
      applyOptimistic(job, 'closed', ctx, {
        nonce: 'nonce-4',
        enqueue: (mutation) => {
          calls.push(mutation);
        },
      }),
    /no transition from 'new' to 'closed'/
  );
  assert.equal(calls.length, 0);
});

test('applyOptimistic: a failing enqueue sink rejects the call', async () => {
  const job = makeJob({ status: 'new' });
  const ctx = makeCtx();

  await assert.rejects(
    () =>
      applyOptimistic(job, 'qualified', ctx, {
        nonce: 'nonce-5',
        enqueue: async () => {
          throw new Error('enqueue failed');
        },
      }),
    /enqueue failed/
  );
});
