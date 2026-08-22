/**
 * Payroll/earnings types (S3.7 prereq).
 *
 * A pay-period boundary, bonus computation, commission, reimbursement,
 * derived-hours, and close-out state all live here as facets of one
 * payroll/earnings concern — the same one-file-per-concern pattern
 * `clocks.ts` and `state-machine.ts` already follow. Nothing here writes
 * to Supabase or computes a real payroll run; this slice is additive-only,
 * laying down the shapes `Earnings.tsx` (S3.7) will consume.
 */

import type { Job } from './index.js';

/**
 * The start/end boundary of one pay period. Timestamps are ISO strings,
 * matching every other date field on `Job` (`scheduledStart`, `completedAt`,
 * etc.) rather than inventing a `Date`/epoch convention.
 */
export interface PayPeriod {
  start: string;
  end: string;
}

/**
 * A bonus computation rule for a job within a pay period. Kept minimally
 * sufficient to compute a dollar amount: `compute` is the rule's actual
 * behavior, `id`/`description` are what a UI or audit trail displays.
 */
export interface BonusRule {
  id: string;
  description: string;
  compute: (job: Job, period: PayPeriod) => number;
}

/**
 * Null-object implementation of `BonusRule` (GoF null-object pattern): a
 * rule that always yields $0.00, so callers never need to null-check for
 * "no bonus rule configured" before invoking `compute`.
 */
export const NullBonusRule: BonusRule = {
  id: 'null-bonus-rule',
  description: 'No bonus applies.',
  compute: () => 0,
};

/** A commission amount tied to a single job. */
export interface Commission {
  jobId: string;
  amount: number;
}

/** A reimbursement amount tied to a single job. */
export interface Reimbursement {
  jobId: string;
  amount: number;
}

/**
 * Hours derived from device-clock `occurredAt` timestamps, NOT `syncedAt`.
 * Per `clocks.ts`/`index.ts`'s existing doc comments, `occurredAt` is the
 * payroll-relevant input (what the tech's device recorded happening, in the
 * field, at the time) — `syncedAt` only records when that event reached the
 * server, which can lag `occurredAt` by any amount (offline queue replay,
 * connectivity gaps) and would silently shift or inflate a tech's hours if
 * used for payroll math instead.
 */
export interface DerivedHours {
  jobId: string;
  /** ISO string — device-clock `occurredAt`, not server-clock `syncedAt`. */
  from: string;
  /** ISO string — device-clock `occurredAt`, not server-clock `syncedAt`. */
  to: string;
  hours: number;
}

/**
 * Pending-close-out state for a pay period/earnings record: whether the
 * period's earnings (hours, bonuses, commissions, reimbursements) have been
 * finalized, and by whom/when if so.
 */
export interface CloseOut {
  period: PayPeriod;
  closed: boolean;
  closedAt: string | null;
  closedBy: string | null;
}
