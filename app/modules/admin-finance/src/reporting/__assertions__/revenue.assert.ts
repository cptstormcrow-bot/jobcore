/**
 * Assertions for the admin-finance reporting revenue helpers (P3l.5).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup (AC-8): no DB, no network, no env vars, no faked
 * clock. Every timestamp used below is a fixed ISO literal, never
 * `Date.now()` or a mock/fake clock library.
 *
 * All money values in these fixtures are INTEGER CENTS.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { commissionTotals, commissionsFromPayoutLines, type CommissionAmountSource } from '../revenue';

test('AC: commissionTotals sums present amount fields into totalCommission/knownCount', () => {
  const records: CommissionAmountSource[] = [
    { jobId: 'job-1', amount: 2000 },
    { jobId: 'job-2', amount: 3000 },
    { jobId: 'job-3', amount: 500 },
  ];

  const result = commissionTotals(records);

  assert.equal(result.totalCommission, 5500);
  assert.equal(result.knownCount, 3);
  assert.equal(result.unknownCount, 0);
  assert.equal(result.jobCount, 3);
});

test('AC: a null amount and an undefined amount are both excluded from totalCommission and counted as unknown, never zero', () => {
  const records: CommissionAmountSource[] = [
    { jobId: 'job-1', amount: 1000 },
    { jobId: 'job-2', amount: null },
    { jobId: 'job-3', amount: undefined },
  ];

  const result = commissionTotals(records);

  assert.equal(result.totalCommission, 1000);
  assert.equal(result.knownCount, 1);
  assert.equal(result.unknownCount, 2);
});

test('AC: jobCount === knownCount + unknownCount always', () => {
  const records: CommissionAmountSource[] = [
    { jobId: 'job-1', amount: 1000 },
    { jobId: 'job-2', amount: null },
    { jobId: 'job-3', amount: undefined },
    { jobId: 'job-4', amount: 250 },
  ];

  const result = commissionTotals(records);

  assert.equal(result.jobCount, records.length);
  assert.equal(result.jobCount, result.knownCount + result.unknownCount);
});

test('AC-8: the whole suite runs with zero setup — no DB, no network, no env vars, no faked clock', () => {
  assert.equal(typeof process.env.DATABASE_URL, 'undefined');
  assert.equal(typeof process.env.SUPABASE_URL, 'undefined');
});

test('AC: commissionsFromPayoutLines folds several technician lines of one job into one record, so jobCount stays one per job', () => {
  const lines = [
    { jobId: 'job-1', amountCents: 1000 },
    { jobId: 'job-1', amountCents: 500 },
    { jobId: 'job-2', amountCents: 700 },
  ];

  const folded = commissionsFromPayoutLines(lines);

  assert.deepEqual(folded, [
    { jobId: 'job-1', amount: 1500 },
    { jobId: 'job-2', amount: 700 },
  ]);

  const totals = commissionTotals(folded);

  assert.equal(totals.totalCommission, 2200);
  assert.equal(totals.knownCount, 2);
  assert.equal(totals.unknownCount, 0);
  assert.equal(totals.jobCount, 2);
});

test('AC: commissionsFromPayoutLines of no lines is an empty list and totals to zero', () => {
  const folded = commissionsFromPayoutLines([]);

  assert.deepEqual(folded, []);

  const totals = commissionTotals(folded);

  assert.equal(totals.totalCommission, 0);
  assert.equal(totals.jobCount, 0);
});

test('AC: a legacy commissions row and per-technician lines concatenate and both count toward totalCommission', () => {
  const legacy: CommissionAmountSource[] = [{ jobId: 'job-1', amount: 2000 }];

  const combined = [
    ...legacy,
    ...commissionsFromPayoutLines([
      { jobId: 'job-1', amountCents: 1500 },
      { jobId: 'job-2', amountCents: 250 },
    ]),
  ];

  const totals = commissionTotals(combined);

  // The two payouts of job-1 are separate records - a documented limit.
  assert.equal(totals.totalCommission, 3750);
  assert.equal(totals.knownCount, 3);
  assert.equal(totals.jobCount, 3);
});

test('AC: commissionsFromPayoutLines keeps first-appearance job order and treats a zero-cent line as a known zero', () => {
  const lines = [
    { jobId: 'job-b', amountCents: 0 },
    { jobId: 'job-a', amountCents: 300 },
    { jobId: 'job-b', amountCents: 0 },
  ];

  const folded = commissionsFromPayoutLines(lines);

  assert.deepEqual(folded, [
    { jobId: 'job-b', amount: 0 },
    { jobId: 'job-a', amount: 300 },
  ]);

  const totals = commissionTotals(folded);

  assert.equal(totals.knownCount, 2);
  assert.equal(totals.unknownCount, 0);
  assert.equal(totals.totalCommission, 300);
});
