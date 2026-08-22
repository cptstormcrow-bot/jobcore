/**
 * Pure payout-batch freezing for the admin-finance money core (P3k.1).
 *
 * `buildPayoutBatch` describes — it never executes. It takes a period's
 * already-computed `PeriodPayResult` lines (P3c.5, `./types.ts`) and freezes
 * each one BY VALUE COPY into a `PayoutBatch`, stamping every line with
 * `frozen_at` (a caller-supplied ISO timestamp — this module never calls
 * `Date.now()`, matching `publish-plan.ts`'s determinism discipline) and a
 * `sourceHash` string that fingerprints the line's inputs at freeze time.
 *
 * "BY VALUE COPY" means each `PeriodPayResult` is spread into a brand-new
 * object on the frozen line — never a reference to the caller's object — so
 * a later in-place mutation of the caller's array can never retroactively
 * alter a batch that has already been frozen.
 *
 * Field naming and amount shape mirror `payout_batches` / `payout_lines`
 * (P3a.4, `app/supabase/0005_money.sql:188-224`): batch carries
 * `organizationId`, `periodStart`, `periodEnd`; each line carries
 * `hoursAmount`, `commissionAmount`, `bonusAmount`, `reimbursementAmount`,
 * and `totalAmount` — all integer cents (`Money`) — plus the `userId` the
 * line belongs to. `totalAmount` is the `PeriodPayResult.total` value as
 * computed upstream, unchanged here, matching the DB's
 * `payout_lines_total_amount_check` CHECK constraint.
 *
 * No Date, no Math.random, no I/O, no Supabase, no fetch, no React.
 */

import type { PeriodPayResult, Money, CalculationResult } from './types';

/** One user's pay for the period, frozen at batch-build time. */
export interface FrozenPayoutLine {
  userId: string;
  hoursAmount: Money;
  commissionAmount: Money;
  bonusAmount: Money;
  reimbursementAmount: Money;
  totalAmount: Money;
  /** ISO timestamp this line was frozen at, supplied by the caller as `now`. */
  frozenAt: string;
  /** Fingerprint of this line's source inputs at freeze time. */
  sourceHash: string;
}

/** A batch of frozen pay lines for one organization's pay period. */
export interface PayoutBatch {
  /** Absent before this batch has been persisted (assigned by the DB on insert). */
  id?: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  /** Absent before this batch has been persisted; `'draft' | 'approved' | 'paid'` per the DB enum once persisted. */
  status?: string;
  lines: FrozenPayoutLine[];
}

/** One user's period result plus the identifiers needed to freeze it. */
export interface PayoutBatchInput {
  userId: string;
  periodPayResult: PeriodPayResult;
}

/**
 * Builds a `PayoutBatch` for `organizationId` over `[periodStart, periodEnd]`
 * from `inputs`, freezing each `PeriodPayResult` BY VALUE COPY with `now` as
 * `frozenAt` and a computed `sourceHash` per line.
 *
 * Rejects (does not throw) when `inputs` is empty — a payout batch with zero
 * lines is never a valid data description to hand to the batch-creation RPC.
 */
export function buildPayoutBatch(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
  inputs: PayoutBatchInput[],
  now: string,
): CalculationResult<PayoutBatch> {
  if (inputs.length === 0) {
    return {
      ok: false,
      reason: `payout batch for organization ${organizationId} has no pay lines`,
    };
  }

  const lines: FrozenPayoutLine[] = inputs.map((input) => {
    // Value copy of the PeriodPayResult's fields — never a reference to the
    // caller's object.
    const result = input.periodPayResult;
    const frozen: FrozenPayoutLine = {
      userId: input.userId,
      hoursAmount: result.hoursAmount,
      commissionAmount: result.commissionAmount,
      bonusAmount: result.bonusAmount,
      reimbursementAmount: result.reimbursementAmount,
      totalAmount: result.total,
      frozenAt: now,
      sourceHash: hashPayoutLineSource(organizationId, periodStart, periodEnd, input),
    };
    return frozen;
  });

  const batch: PayoutBatch = {
    organizationId,
    periodStart,
    periodEnd,
    lines,
  };

  return { ok: true, value: batch };
}

/**
 * Deterministic, dependency-free fingerprint of one payout line's source
 * inputs. Not cryptographic — a stable string digest so a later re-freeze of
 * the same inputs can be detected as identical, and a changed input as
 * different. Uses a simple FNV-1a-style hash over a canonical string so this
 * file pulls in no crypto or hashing library.
 */
function hashPayoutLineSource(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
  input: PayoutBatchInput,
): string {
  const result = input.periodPayResult;
  const canonical = [
    organizationId,
    periodStart,
    periodEnd,
    input.userId,
    result.hoursAmount,
    result.commissionAmount,
    result.bonusAmount,
    result.reimbursementAmount,
    result.total,
  ].join('|');

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Unsigned 32-bit hex string.
  return (hash >>> 0).toString(16).padStart(8, '0');
}
