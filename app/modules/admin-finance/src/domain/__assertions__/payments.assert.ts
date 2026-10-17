/**
 * Assertions for the payments balance helpers. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  invoiceTotalCents,
  settledTotalCents,
  balanceCents,
  canRecordPayment,
} from '../payments';

const est = (totalCost: number, status = 'approved') => ({ totalCost, status }) as any;
const pay = (amount: number, status: string) => ({ amount, status }) as any;
const job = (status: string) => ({ status }) as any;

test('invoiceTotalCents converts dollars to cents', () => {
  assert.equal(invoiceTotalCents(est(100.1)), 10010);
});

test('single settled payment reduces balance', () => {
  assert.equal(balanceCents(10000, [pay(40, 'confirmed')]), 6000);
});

test('staged payments reduce balance cumulatively', () => {
  const ps = [pay(25, 'confirmed'), pay(25.5, 'manual_confirmed')];
  assert.equal(settledTotalCents(ps), 5050);
  assert.equal(balanceCents(10000, ps), 4950);
});

test('pending and failed payments are not counted', () => {
  const ps = [pay(50, 'pending'), pay(50, 'failed'), pay(10, 'confirmed')];
  assert.equal(settledTotalCents(ps), 1000);
  assert.equal(balanceCents(10000, ps), 9000);
});

test('empty payments leaves balance equal to invoice', () => {
  assert.equal(balanceCents(10000, []), 10000);
});

test('canRecordPayment true for approved estimate on in-progress job', () => {
  assert.equal(canRecordPayment(job('in_progress'), est(1)), true);
});

test('canRecordPayment true for approved estimate on completed job', () => {
  assert.equal(canRecordPayment(job('completed'), est(1)), true);
});

test('canRecordPayment false for non-approved estimate', () => {
  assert.equal(canRecordPayment(job('completed'), est(1, 'draft')), false);
});

test('canRecordPayment false for cancelled job', () => {
  assert.equal(canRecordPayment(job('cancelled'), est(1)), false);
});
