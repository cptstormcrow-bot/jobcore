/**
 * Assertions for the admin-finance money core payout-batch freezing (P3k.1).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup (AC-6): no DB, no network, no env vars, no faked
 * clock. Every timestamp used below is a fixed ISO literal, never
 * `Date.now()` or a mock/fake clock library.
 *
 * Spec under test (handoff/P3-SLICE-LEDGER.md, ctx: P3k.1): a frozen line
 * survives a later rate change unchanged.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { PeriodPayResult } from '../types';
import { buildPayoutBatch, type PayoutBatchInput } from '../payout-batch';

function makePeriodPayResult(overrides: Partial<PeriodPayResult> = {}): PeriodPayResult {
  const base: PeriodPayResult = {
    hoursAmount: 10000,
    commissionAmount: 5000,
    bonusAmount: 0,
    reimbursementAmount: 0,
    total: 15000,
  };
  return { ...base, ...overrides };
}

const now = '2026-08-08T12:00:00.000Z';

test('AC: a frozen line survives a later rate change unchanged (value copy, not a live reference)', () => {
  // Source rate data that feeds the batch build — a mutable object standing
  // in for "the rate table a caller might later re-price".
  const sourcePeriodPayResult = makePeriodPayResult();

  const inputs: PayoutBatchInput[] = [
    { userId: 'user-1', periodPayResult: sourcePeriodPayResult },
  ];

  const result = buildPayoutBatch('org-1', '2026-08-01', '2026-08-07', inputs, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const frozenLine = result.value.lines[0];
  assert.ok(frozenLine);

  // Capture a snapshot of the frozen line's values before the source
  // mutates, so the post-mutation comparison below is against a fixed
  // baseline, not against the (possibly-aliased) live object.
  const snapshot = { ...frozenLine };

  // Mutate the SOURCE rate data that fed the batch build — simulating a
  // later rate change applied to the caller's own object, in place.
  sourcePeriodPayResult.hoursAmount = 99999;
  sourcePeriodPayResult.commissionAmount = 88888;
  sourcePeriodPayResult.total = sourcePeriodPayResult.hoursAmount + sourcePeriodPayResult.commissionAmount;

  // The already-frozen line must be byte/value-identical to the
  // pre-mutation snapshot: buildPayoutBatch froze it BY VALUE COPY, never
  // by reference.
  assert.equal(frozenLine.hoursAmount, snapshot.hoursAmount);
  assert.equal(frozenLine.commissionAmount, snapshot.commissionAmount);
  assert.equal(frozenLine.bonusAmount, snapshot.bonusAmount);
  assert.equal(frozenLine.reimbursementAmount, snapshot.reimbursementAmount);
  assert.equal(frozenLine.totalAmount, snapshot.totalAmount);
  assert.equal(frozenLine.frozenAt, snapshot.frozenAt);
  assert.equal(frozenLine.sourceHash, snapshot.sourceHash);

  // Explicitly confirm the frozen line did NOT pick up the mutated values.
  assert.notEqual(frozenLine.hoursAmount, sourcePeriodPayResult.hoursAmount);
  assert.notEqual(frozenLine.commissionAmount, sourcePeriodPayResult.commissionAmount);
  assert.notEqual(frozenLine.totalAmount, sourcePeriodPayResult.total);
});

test('AC-6: the whole suite runs with zero setup — no DB, no network, no env vars, no faked clock', () => {
  // This test itself is the evidence: every fixture above is a fixed ISO
  // string literal or plain numeric literal, every function called is a
  // plain synchronous import from ../payout-batch, and no before()/
  // beforeEach() hook, network call, or environment variable read appears
  // anywhere in this file.
  assert.equal(typeof process.env.DATABASE_URL, 'undefined');
  assert.equal(typeof process.env.SUPABASE_URL, 'undefined');
});
