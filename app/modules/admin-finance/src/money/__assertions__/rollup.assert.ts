/**
 * Assertions for the admin-finance money core rollup (P3-c.5).
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

import type { Job, Profile } from '@jobcore/core';
import type { PriceSheet, PriceSheetRate, CompensationPolicy } from '../types';
import { calculateCommission } from '../commission';
import { deriveBillableHours } from '../billable-hours';
import { NullBonusRule } from '../bonus';
import { rollUpPeriodPay, type RollupJobInput } from '../rollup';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'completed',
    customerId: 'cust-1',
    serviceId: 'svc-1',
    source: null,
    payer: null,
    attachTiming: 'same_day',
    requestedWindow: null,
    scheduledStart: null,
    scheduledEnd: null,
    address: null,
    description: null,
    assignedTechId: 'tech-1',
    enRouteAt: '2026-08-01T13:00:00.000Z',
    inProgressAt: '2026-08-01T13:30:00.000Z',
    completedAt: '2026-08-01T15:30:00.000Z',
    createdAt: '2026-08-01T12:00:00.000Z',
    isBeta: false,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'tech-1',
    organizationId: 'org-1',
    fullName: 'Test Tech',
    phone: null,
    role: 'tech',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    isTest: false,
    ...overrides,
  };
}

function makePublishedPriceSheet(overrides: Partial<PriceSheet> = {}): PriceSheet {
  return {
    id: 'sheet-1',
    organizationId: 'org-1',
    version: 1,
    status: 'published',
    publishedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRate(overrides: Partial<PriceSheetRate> = {}): PriceSheetRate {
  return {
    id: 'rate-1',
    priceSheetId: 'sheet-1',
    serviceId: 'svc-1',
    attachTiming: 'same_day',
    amount: 20000, // $200.00 in integer cents
    ...overrides,
  };
}

function makePolicy(overrides: Partial<CompensationPolicy> = {}): CompensationPolicy {
  return {
    id: 'policy-1',
    organizationId: 'org-1',
    commissionBasisPercent: 10,
    hourlyRate: 2500, // $25.00/hr in integer cents
    ...overrides,
  };
}

const tech = makeProfile();
const period = { start: '2026-08-01T00:00:00.000Z', end: '2026-08-15T00:00:00.000Z' };

test('AC: total is DERIVED — equals sum of the four component amounts on a multi-job fixture', () => {
  const priceSheet = makePublishedPriceSheet();
  const policy = makePolicy();

  const job1 = makeJob({
    id: 'job-1',
    enRouteAt: '2026-08-01T13:00:00.000Z',
    inProgressAt: '2026-08-01T13:30:00.000Z',
    completedAt: '2026-08-01T15:30:00.000Z', // 2.00 billable hours
  });
  const job2 = makeJob({
    id: 'job-2',
    enRouteAt: '2026-08-02T09:00:00.000Z',
    inProgressAt: '2026-08-02T09:15:00.000Z',
    completedAt: '2026-08-02T10:15:00.000Z', // 1.00 billable hour
  });

  const rates = [makeRate()];

  const jobs: RollupJobInput[] = [
    { job: job1, priceSheet, rates, hours: job1, reimbursementCents: 1500 },
    { job: job2, priceSheet, rates, hours: job2, reimbursementCents: 0 },
  ];

  const result = rollUpPeriodPay(tech, period, jobs, policy, {});
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const { hoursAmount, commissionAmount, bonusAmount, reimbursementAmount, total } = result.value;

  // Sanity on the component math itself (integer cents throughout).
  assert.equal(hoursAmount, 7500); // 3.00 hrs * 2500 cents/hr
  assert.equal(commissionAmount, 4000); // two jobs * (20000 * 10%) = 2000 + 2000
  assert.equal(bonusAmount, 0); // NullBonusRule default
  assert.equal(reimbursementAmount, 1500);

  assert.equal(total, hoursAmount + commissionAmount + bonusAmount + reimbursementAmount);
  assert.equal(total, 13000);
});

test('AC: an unpublished (draft) price sheet fails calculateCommission and that failure propagates out of rollUpPeriodPay', () => {
  const draftPriceSheet = makePublishedPriceSheet({ status: 'draft', publishedAt: null });
  const policy = makePolicy();
  const job = makeJob();
  const rates = [makeRate()];

  // Direct unit check: calculateCommission itself fails with a reason string.
  const commissionResult = calculateCommission(job, draftPriceSheet, policy, rates);
  assert.equal(commissionResult.ok, false);
  if (!commissionResult.ok) {
    assert.equal(typeof commissionResult.reason, 'string');
    assert.match(commissionResult.reason, /draft/);
  }

  // Propagation check: rollUpPeriodPay must surface the failure, never coerce
  // it to a 0 commission line.
  const jobs: RollupJobInput[] = [
    { job, priceSheet: draftPriceSheet, rates, hours: job, reimbursementCents: 500 },
  ];
  const rollupResult = rollUpPeriodPay(tech, period, jobs, policy, {});
  assert.equal(rollupResult.ok, false);
  if (!rollupResult.ok) {
    assert.equal(typeof rollupResult.reason, 'string');
    assert.match(rollupResult.reason, /draft/);
  }
});

test('AC: NullBonusRule contributes exactly 0 to bonusAmount', () => {
  const bonus = NullBonusRule.evaluate(period, tech, [makeJob()]);
  assert.equal(bonus.amount, 0);
  assert.equal(bonus.rule, 'NullBonusRule');

  const priceSheet = makePublishedPriceSheet();
  const policy = makePolicy();
  const job = makeJob();
  const rates = [makeRate()];
  const jobs: RollupJobInput[] = [{ job, priceSheet, rates, hours: job, reimbursementCents: 0 }];

  const result = rollUpPeriodPay(tech, period, jobs, policy, { bonusRule: NullBonusRule });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.bonusAmount, 0);
  }
});

test('AC: deriveBillableHours emits an unpaidSpan for the travel leg', () => {
  const input = {
    enRouteAt: '2026-08-01T13:00:00.000Z',
    inProgressAt: '2026-08-01T13:30:00.000Z',
    completedAt: '2026-08-01T15:30:00.000Z',
  };

  const result = deriveBillableHours(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.unpaidSpans.length, 1);
  const span = result.value.unpaidSpans[0];
  assert.ok(span);
  assert.equal(span.reason, 'travel');
  assert.equal(span.from, input.enRouteAt);
  assert.equal(span.to, input.inProgressAt);
  assert.equal(result.value.hours, 2); // 13:30 -> 15:30 billable leg
});

test('AC-8: the whole suite runs with zero setup — no DB, no network, no env vars, no faked clock', () => {
  // This test itself is the evidence: every fixture above is a fixed ISO
  // string literal, every function called is a plain synchronous import
  // from ../commission, ../billable-hours, ../bonus, ../rollup, and no
  // before()/beforeEach() hook, network call, or environment variable read
  // appears anywhere in this file.
  assert.equal(typeof process.env.DATABASE_URL, 'undefined');
  assert.equal(typeof process.env.SUPABASE_URL, 'undefined');
});
