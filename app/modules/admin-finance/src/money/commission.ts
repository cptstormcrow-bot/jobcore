/**
 * Pure commission calculation for the admin-finance money core (P3-c.2).
 *
 * No global/module-level mutable state, no clock, no env var, no Date.now() —
 * every input arrives as a parameter (AC-8), so this is unit-testable with
 * zero setup. A reimbursement is NEVER referenced or subtracted here.
 */

import type {
  Job,
} from '../../../../packages/core/src/index';
import type {
  PriceSheet,
  PriceSheetRate,
  CompensationPolicy,
  CommissionLine,
  CalculationResult,
} from './types';

/** Rejects any price sheet that is not `published`. */
export function assertPriceSheetPublished(
  priceSheet: PriceSheet,
): { ok: true } | { ok: false; reason: string } {
  if (priceSheet.status !== 'published') {
    return {
      ok: false,
      reason: `price sheet ${priceSheet.id} is '${priceSheet.status}', not 'published'`,
    };
  }
  return { ok: true };
}

/** Finds the rate row matching the job's service and attach timing. */
export function findMatchingRate(
  job: Job,
  rates: readonly PriceSheetRate[],
): { ok: true; value: PriceSheetRate } | { ok: false; reason: string } {
  const match = rates.find(
    (rate) => rate.serviceId === job.serviceId && rate.attachTiming === job.attachTiming,
  );
  if (!match) {
    return {
      ok: false,
      reason: `no rate row for service '${job.serviceId ?? 'null'}' / attachTiming '${
        job.attachTiming ?? 'null'
      }'`,
    };
  }
  return { ok: true, value: match };
}

/** Validates that the compensation policy is present and well-formed. */
export function assertPolicyValid(
  policy: CompensationPolicy | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!policy) {
    return { ok: false, reason: 'compensation policy is missing' };
  }
  if (
    typeof policy.commissionBasisPercent !== 'number' ||
    Number.isNaN(policy.commissionBasisPercent) ||
    policy.commissionBasisPercent < 0
  ) {
    return {
      ok: false,
      reason: `compensation policy ${policy.id} has malformed commissionBasisPercent`,
    };
  }
  return { ok: true };
}

/**
 * Applies a percent-of-cents basis to a rate amount, rounding to the
 * nearest cent (rounds half away from zero via Math.round, since amounts
 * and percents here are always non-negative).
 */
export function applyCommissionBasis(rateAmount: number, commissionBasisPercent: number): number {
  return Math.round((rateAmount * commissionBasisPercent) / 100);
}

/**
 * Calculates the commission owed for one job against a published price
 * sheet and a compensation policy. Snapshots both `priceSheetId` and
 * `compensationPolicyId` onto the result so a later re-publish of either
 * never retroactively moves historical pay (AC per types.ts CommissionLine).
 */
export function calculateCommission(
  job: Job,
  priceSheet: PriceSheet,
  policy: CompensationPolicy,
  rates: readonly PriceSheetRate[],
): CalculationResult<CommissionLine> {
  const publishedCheck = assertPriceSheetPublished(priceSheet);
  if (!publishedCheck.ok) {
    return publishedCheck;
  }

  const policyCheck = assertPolicyValid(policy);
  if (!policyCheck.ok) {
    return policyCheck;
  }

  const rateCheck = findMatchingRate(job, rates);
  if (!rateCheck.ok) {
    return rateCheck;
  }

  const amount = applyCommissionBasis(rateCheck.value.amount, policy.commissionBasisPercent);

  const line: CommissionLine = {
    jobId: job.id,
    priceSheetId: priceSheet.id,
    compensationPolicyId: policy.id,
    amount,
  };

  return { ok: true, value: line };
}
