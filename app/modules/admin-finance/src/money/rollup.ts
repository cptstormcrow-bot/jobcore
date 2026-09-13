/**
 * Pure pay-period rollup for the admin-finance money core (P3-c.5).
 *
 * Combines the three existing calculators (`calculateCommission`,
 * `deriveBillableHours`, a `BonusRule`) plus a reimbursement total into the
 * `PeriodPayResult` breakdown defined in `types.ts`. `total` is DERIVED —
 * the exact sum of the four amount fields — never a caller-supplied value,
 * mirroring the DB check constraint
 * `total_amount = hours_amount + commission_amount + bonus_amount +
 * reimbursement_amount`.
 *
 * PURE (AC-8): no clock, no globals, no async, no I/O — every input arrives
 * as a parameter. Imports are limited to this `money/` directory and
 * `@jobcore/core` types.
 */

import type { Job, Profile } from '@jobcore/core';
import type {
  PriceSheet,
  PriceSheetRate,
  CompensationPolicy,
  CalculationResult,
  PeriodPayResult,
  TimeSegmentReasonCode,
} from './types';
import { calculateCommission } from './commission';
import { deriveBillableHours, type BillableHoursInput } from './billable-hours';
import type { BonusRule } from './bonus';
import { NullBonusRule } from './bonus';

/** `Profile` lacks `paidTravel` (planned migration 0059). Extend locally. */
export type PayrollTech = Profile & { paidTravel?: boolean };

/** A closed pay period. */
export interface PayPeriod {
  start: string;
  end: string;
}

/**
 * One job's inputs to the rollup: the job itself, the price sheet and rate
 * table its commission is calculated against, and the payroll-grade
 * time segments `deriveBillableHours` reads. Reimbursements are tracked
 * per-job in integer cents; they are added straight through, never
 * deducted against commission (mirrors `CommissionLine`'s hard constraint
 * in types.ts).
 */
export interface RollupJobInput {
  job: Job;
  priceSheet: PriceSheet;
  rates: readonly PriceSheetRate[];
  hours: BillableHoursInput;
  reimbursementCents: number;
}

/**
 * Additional inputs beyond the four named in the spec (tech, period, jobs,
 * policy). DISCLOSED DEVIATION: the spec's four-argument shape cannot carry
 * a price sheet, a rate table, or a bonus rule, all of which
 * `calculateCommission`/`BonusRule.evaluate` require as-built. Rather than
 * fake those away, this rollup takes a fifth `options` parameter bundling
 * them, defaulting `bonusRule` to `NullBonusRule` (see bonus.ts).
 */
export interface RollupOptions {
  bonusRule?: BonusRule;
}

/**
 * Rolls up one tech's pay for one period across a set of jobs.
 *
 * Failure policy (explicit, not silent-zero): if `deriveBillableHours` or
 * `calculateCommission` fails for ANY job in the set, that failure is
 * propagated as this function's own `CalculationResult` failure — a
 * partial/wrong payroll total is worse than refusing to compute one, so no
 * failed line is ever silently coerced to a 0 amount.
 */
export function rollUpPeriodPay(
  tech: PayrollTech,
  period: PayPeriod,
  jobs: RollupJobInput[],
  policy: CompensationPolicy,
  options: RollupOptions = {},
): CalculationResult<PeriodPayResult> {
  const bonusRule = options.bonusRule ?? NullBonusRule;

  const hoursByReason: Record<TimeSegmentReasonCode, number> = {
    job_labor: 0, lunch: 0, materials: 0, prem_visit: 0, travel: 0, other: 0,
  };
  let commissionAmount = 0;
  let reimbursementAmount = 0;

  for (const entry of jobs) {
    const hoursResult = deriveBillableHours(entry.hours);
    if (!hoursResult.ok) {
      return { ok: false, reason: `job ${entry.job.id}: ${hoursResult.reason}` };
    }
    for (const k of Object.keys(hoursByReason) as TimeSegmentReasonCode[]) {
      hoursByReason[k] += hoursResult.value.hoursByReason[k];
    }

    const commissionResult = calculateCommission(entry.job, entry.priceSheet, policy, entry.rates);
    if (!commissionResult.ok) {
      return { ok: false, reason: `job ${entry.job.id}: ${commissionResult.reason}` };
    }
    commissionAmount += commissionResult.value.amount;

    reimbursementAmount += entry.reimbursementCents;
  }

  // Only job_labor + prem_visit are always paid; travel only if
  // tech.paidTravel. lunch/materials/other are bookkeeping-only.
  const payableHours =
    hoursByReason.job_labor +
    hoursByReason.prem_visit +
    (tech.paidTravel ? hoursByReason.travel : 0);
  const hoursAmount = Math.round(payableHours * policy.hourlyRate);

  const bonusResult = bonusRule.evaluate(
    period,
    tech,
    jobs.map((entry) => entry.job),
  );
  const bonusAmount = bonusResult.amount;

  const total = hoursAmount + commissionAmount + bonusAmount + reimbursementAmount;

  return {
    ok: true,
    value: {
      hoursAmount,
      commissionAmount,
      bonusAmount,
      reimbursementAmount,
      total,
    },
  };
}
