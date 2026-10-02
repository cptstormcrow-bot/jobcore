/**
 * Assertions for the admin-finance "Mark Paid" guard (`markJobPaid`):
 * `completed -> paid` requires a settled payment only when payer is customer,
 * and `jobs.updateStatus` runs exactly once, only after the transition succeeds.
 *
 * Runs under `node --experimental-strip-types --test` — no DB, no network.
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import type { Ctx, Job } from '@jobcore/core';
import { markJobPaid } from '../flows/mark-paid.js';
import type { Payment, PaymentStatus } from '../data/ports.js';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'completed',
    customerId: null,
    serviceId: null,
    source: null,
    payer: 'customer',
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
    isBeta: false,
    totalLaborSeconds: 0,
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

function makePayment(status: PaymentStatus): Payment {
  return { id: 'pay-' + status, jobId: 'job-1', status } as unknown as Payment;
}

function makePorts(statuses: PaymentStatus[], calls: string[] = []) {
  return {
    payments: {
      listForJob: async (_jobId: string) => {
        calls.push('listForJob');
        return statuses.map(makePayment);
      },
    },
    jobs: {
      updateStatus: async (jobId: string, status: string) => {
        calls.push('updateStatus:' + jobId + ':' + status);
        return makeJob({ id: jobId, status: status as Job['status'] });
      },
    },
  } as unknown as Parameters<typeof markJobPaid>[1];
}

describe('markJobPaid', () => {
  test('customer payer with a settled payment: transition to paid is allowed', async () => {
    for (const status of ['confirmed', 'manual_confirmed'] as PaymentStatus[]) {
      const calls: string[] = [];
      await markJobPaid(makeJob(), makePorts([status], calls), makeCtx());
      assert.deepEqual(calls, ['listForJob', 'updateStatus:job-1:paid']);
    }
  });

  test('customer payer with no settled payment: rejected', async () => {
    const calls: string[] = [];
    await assert.rejects(() => markJobPaid(makeJob(), makePorts([], calls), makeCtx()), /payment record/);
    assert.deepEqual(calls, ['listForJob']);
  });

  test('pending and failed payments do not count as settled: rejected', async () => {
    const calls: string[] = [];
    await assert.rejects(
      () => markJobPaid(makeJob(), makePorts(['pending', 'failed'], calls), makeCtx()),
      /payment record/
    );
    assert.deepEqual(calls, ['listForJob']);
  });

  test('non-customer payer: paid allowed without a settled payment', async () => {
    const calls: string[] = [];
    await markJobPaid(makeJob({ payer: 'insurance' }), makePorts([], calls), makeCtx());
    assert.deepEqual(calls, ['listForJob', 'updateStatus:job-1:paid']);
  });

  test('updateStatus is called exactly once, and only after the transition succeeds', async () => {
    const order: string[] = [];
    const ok = makePorts(['confirmed'], order);
    await markJobPaid(makeJob(), ok, makeCtx({ now: () => (order.push('transition'), '2026-01-01T00:00:00.000Z') }));
    assert.equal(order.filter((c) => c.startsWith('updateStatus')).length, 1);
    assert.equal(order[order.length - 1], 'updateStatus:job-1:paid');
    assert.ok(order.indexOf('listForJob') < order.indexOf('updateStatus:job-1:paid'));

    const failed: string[] = [];
    await assert.rejects(() => markJobPaid(makeJob(), makePorts(['pending'], failed), makeCtx()));
    assert.equal(failed.filter((c) => c.startsWith('updateStatus')).length, 0);
  });
});
