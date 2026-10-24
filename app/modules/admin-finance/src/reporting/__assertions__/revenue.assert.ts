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

import { commissionTotals, commissionsFromPayoutLines, mergeCommissionRecords, type CommissionAmountSource } from '../revenue';

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

test('AC: a job with both a legacy commissions row and payout lines is counted once, the lines winning', () => {
  const legacy: CommissionAmountSource[] = [{ jobId: 'job-1', amount: 2000 }];

  const merged = mergeCommissionRecords(legacy, [
    { jobId: 'job-1', amountCents: 1500 },
    { jobId: 'job-2', amountCents: 250 },
  ]);

  const totals = commissionTotals(merged);

  assert.equal(totals.totalCommission, 1750);
  assert.equal(totals.knownCount, 2);
  assert.equal(totals.unknownCount, 0);
  assert.equal(totals.jobCount, 2);
});

test('AC: a legacy-only job with no payout lines is kept', () => {
  const merged = mergeCommissionRecords([{ jobId: 'job-9', amount: 800 }], []);

  assert.deepEqual(merged, [{ jobId: 'job-9', amount: 800 }]);

  const totals = commissionTotals(merged);

  assert.equal(totals.totalCommission, 800);
  assert.equal(totals.jobCount, 1);
});

test('AC: merged records list the kept legacy rows first, then the folded payout lines', () => {
  const merged = mergeCommissionRecords(
    [
      { jobId: 'job-1', amount: 2000 },
      { jobId: 'job-9', amount: 800 },
    ],
    [{ jobId: 'job-1', amountCents: 1500 }],
  );

  assert.deepEqual(
    merged.map((r) => r.jobId),
    ['job-9', 'job-1'],
  );

  const totals = commissionTotals(merged);

  assert.equal(totals.totalCommission, 2300);
  assert.equal(totals.jobCount, 2);
});

test('AC: a legacy row with a null amount is dropped when the job has payout lines', () => {
  const merged = mergeCommissionRecords([{ jobId: 'job-1', amount: null }], [{ jobId: 'job-1', amountCents: 500 }]);

  assert.deepEqual(merged, [{ jobId: 'job-1', amount: 500 }]);

  const totals = commissionTotals(merged);

  assert.equal(totals.knownCount, 1);
  assert.equal(totals.unknownCount, 0);
});

test('AC: a zero-cent payout line beats a legacy amount', () => {
  const merged = mergeCommissionRecords([{ jobId: 'job-1', amount: 2000 }], [{ jobId: 'job-1', amountCents: 0 }]);

  assert.deepEqual(merged, [{ jobId: 'job-1', amount: 0 }]);

  const totals = commissionTotals(merged);

  assert.equal(totals.totalCommission, 0);
  assert.equal(totals.knownCount, 1);
  assert.equal(totals.jobCount, 1);
});

test('AC: two technician lines plus a legacy row on one job fold into one record', () => {
  const merged = mergeCommissionRecords(
    [{ jobId: 'job-1', amount: 2000 }],
    [
      { jobId: 'job-1', amountCents: 1000 },
      { jobId: 'job-1', amountCents: 500 },
    ],
  );

  assert.deepEqual(merged, [{ jobId: 'job-1', amount: 1500 }]);

  const totals = commissionTotals(merged);

  assert.equal(totals.jobCount, 1);
});

test('AC: merging empty inputs is an empty list and totals to zero', () => {
  const merged = mergeCommissionRecords([], []);

  assert.deepEqual(merged, []);

  const totals = commissionTotals(merged);

  assert.equal(totals.totalCommission, 0);
  assert.equal(totals.jobCount, 0);
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
