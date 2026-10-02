/**
 * Pure commission-revenue reporting helper (P3l.3a/3b).
 *
 * CORE INVARIANT: every total this file produces is a SUM of snapshot
 * amounts already persisted on a `commissions` row — NEVER a value
 * recomputed from `price_sheet_rates.amount_cents`,
 * `compensation_policies.commission_basis_percent`, or any other rate/
 * percentage. This mirrors the payout-freeze/snapshot discipline in
 * `../money/commission.ts` (`calculateCommission` snapshots `priceSheetId`/
 * `compensationPolicyId` onto `CommissionLine` so a later re-publish never
 * retroactively moves historical pay) and `../money/rollup.ts`/
 * `../money/payout-batch.ts` (`FrozenPayoutLine`, frozen amount columns).
 *
 * KNOWN LIMITATION — no "revenue" figure exists in this schema. Checked
 * `app/supabase/migrations/0005_money.sql`'s `commissions` table (id, organization_id,
 * job_id, user_id, price_sheet_id, compensation_policy_id, amount_cents,
 * voided_at, created_at, updated_at) and `../money/types.ts`'s
 * `CommissionLine` (jobId, priceSheetId, compensationPolicyId, amount): the
 * ONLY money snapshot either one carries is the commission amount itself.
 * The price/rate that produced it (`price_sheet_rates.amount_cents`) is
 * referenced only by the immutable `priceSheetId` FK, never copied onto the
 * commission row — recovering it would mean re-joining back to
 * `price_sheet_rates` at report time, which is exactly the recomputation
 * this file's CORE INVARIANT forbids. So this report aggregates commission
 * totals only; it does NOT expose a `totalRevenue` field, because doing so
 * honestly would require either inventing a field that doesn't exist or
 * silently recomputing one — both rejected. Widening the schema to snapshot
 * a per-job revenue amount onto `commissions` is a follow-up, not something
 * to fake here.
 *
 * `amount` on the structural `CommissionAmountSource` below is typed
 * `Money | null | undefined` even though `CommissionLine.amount` is a
 * non-optional `Money` — this widens tolerance for not-yet-validated wire
 * data (a repository row read straight off `commissions.amount_cents`
 * before any validation), mirroring `group-by.ts`'s `bySource`/
 * `byAttachTiming` and `slot-hit-rate.ts`'s treatment of nullable wire
 * fields. A missing/null amount is honestly excluded from the total and
 * counted separately as `unknown` — NEVER silently treated as zero.
 */

import type { Money } from '../money/types';

/**
 * The minimal structural shape this report needs from a commission record —
 * a subset of `CommissionLine` (`../money/types.ts`) widened to tolerate a
 * null/undefined `amount` for honest-unknown handling. Any real
 * `CommissionLine` satisfies this shape.
 */
export interface CommissionAmountSource {
  jobId: string;
  amount: Money | null | undefined;
}

/** Aggregate commission totals over a set of commission records. */
export interface CommissionTotalsResult {
  /** Sum of every present `amount` — a snapshot total, never recomputed. */
  totalCommission: Money;
  /** Count of records whose `amount` contributed to `totalCommission`. */
  knownCount: number;
  /** Count of records with a missing/null `amount`, excluded from the total. */
  unknownCount: number;
  /** `knownCount + unknownCount` — every record passed in, regardless of validity. */
  jobCount: number;
}

/**
 * Sums `amount` across `records` into commission totals. A record with a
 * missing/null `amount` is excluded from `totalCommission` and tallied in
 * `unknownCount` instead of being treated as zero — same honest-unknown
 * discipline as `slot-hit-rate.ts`'s `unknown` bucket.
 */
export function commissionTotals(
  records: readonly CommissionAmountSource[],
): CommissionTotalsResult {
  let totalCommission = 0;
  let knownCount = 0;
  let unknownCount = 0;

  for (const record of records) {
    if (record.amount === null || record.amount === undefined) {
      unknownCount += 1;
      continue;
    }
    totalCommission += record.amount;
    knownCount += 1;
  }

  return {
    totalCommission,
    knownCount,
    unknownCount,
    jobCount: records.length,
  };
}
