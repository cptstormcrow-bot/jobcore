/**
 * Assertions for recordJobPayment. Runs under
 * `node --experimental-strip-types --test` — stub repository, no DB or network.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { recordJobPayment } from '../record-job-payment';

const est = (totalCost: number, status = 'approved') => ({ totalCost, status }) as any;
const pay = (amount: number, status = 'confirmed') => ({ amount, status }) as any;
const job = (status = 'in_progress') => ({ id: 'job-1', status }) as any;

function stub() {
  const calls: any[] = [];
  const payments = {
    async recordPayment(orgId: string, jobId: string, input: { amount: number; method: string }) {
      calls.push({ orgId, jobId, input });
      return { id: 'p1', amount: input.amount, method: input.method, status: 'confirmed' } as any;
    },
  } as any;
  return { calls, deps: { payments } };
}

for (const role of ['admin', 'owner']) {
  test(`${role} can record a payment`, async () => {
    const { calls, deps } = stub();
    const r = await recordJobPayment(role, 'org-1', job(), est(100), [], { amountDollars: 25.5, method: 'check' }, deps);
    assert.equal(r.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { orgId: 'org-1', jobId: 'job-1', input: { amount: 25.5, method: 'check' } });
  });
}

test('staged payments: 100 invoice, 40 settled, record 30 -> balance 3000', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100), [pay(40)], { amountDollars: 30, method: 'cash' }, deps);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.balanceCents, 3000);
  assert.equal(calls.length, 1);
});

test('balance reflects new payment', async () => {
  const { deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100), [], { amountDollars: 60.25, method: 'cash' }, deps);
  assert.equal(r.ok && r.balanceCents, 3975);
});

test('non-cash one-cent overpay is blocked', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100), [], { amountDollars: 100.01, method: 'check' }, deps);
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test('cash over balance is blocked', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100), [pay(40)], { amountDollars: 60.01, method: 'cash' }, deps);
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test('cash one-cent overpay is blocked', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100), [], { amountDollars: 100.01, method: 'cash' }, deps);
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test('cash exact-balance payment is allowed', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100), [pay(40)], { amountDollars: 60, method: 'cash' }, deps);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.balanceCents, 0);
  assert.equal(calls.length, 1);
});

test('cash partial payment is allowed', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100), [], { amountDollars: 99.99, method: 'cash' }, deps);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.balanceCents, 1);
  assert.equal(calls.length, 1);
});

test('cash by tech is accepted', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('tech', 'o', job(), est(100), [], { amountDollars: 10, method: 'cash' }, deps);
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
});

test('cash on unapproved estimate is accepted', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('tech', 'o', job(), est(100, 'draft'), [], { amountDollars: 10, method: 'cash' }, deps);
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
});

test('cash on cancelled job is refused', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job('cancelled'), est(100), [], { amountDollars: 10, method: 'cash' }, deps);
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test('exact payment equal to balance succeeds with balance 0', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100), [], { amountDollars: 100, method: 'cash' }, deps);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.balanceCents, 0);
  assert.equal(calls.length, 1);
});

for (const role of ['field_tech', 'manager', 'investigator', 'tech', '']) {
  test(`role '${role}' is refused`, async () => {
    const { calls, deps } = stub();
    const r = await recordJobPayment(role, 'o', job(), est(100), [], { amountDollars: 10, method: 'check' }, deps);
    assert.equal(r.ok, false);
    assert.equal(calls.length, 0);
  });
}

test('unapproved estimate is refused', async () => {
  const { calls, deps } = stub();
  const r = await recordJobPayment('admin', 'o', job(), est(100, 'draft'), [], { amountDollars: 10, method: 'check' }, deps);
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

for (const [label, amt] of [['zero', 0], ['negative', -5], ['NaN', NaN]] as const) {
  test(`amount ${label} is refused`, async () => {
    const { calls, deps } = stub();
    const r = await recordJobPayment('admin', 'o', job(), est(100), [], { amountDollars: amt, method: 'cash' }, deps);
    assert.equal(r.ok, false);
    assert.equal(calls.length, 0);
  });
}
