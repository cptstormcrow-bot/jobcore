/**
 * Earnings screen for the field-tech module (P4 Wave 3 slice S3.7).
 *
 * Derived hours, commissions, reimbursements, bonus, and pending-close-out
 * state for one job, plus a note-only dispute path. Ties to spec AC6, AC7,
 * AC8, VS6.
 *
 * Derived hours use `job.inProgressAt`/`job.completedAt` — these are the
 * `occurred_at`-stamped fields written by `applyTransition`'s device-clock
 * input (see `@jobcore/core`'s `JobTransitionAudit.occurredAt` doc comment),
 * NOT `synced_at`. `synced_at` only records when a transition reached the
 * server and can lag `occurred_at` by any amount under the offline queue
 * (connectivity gaps, replay on reconnect) — using it for payroll math would
 * silently shift or inflate a tech's hours. This screen never reads or
 * displays a `syncedAt`/`synced_at` value for hours.
 *
 * Bonus uses `NullBonusRule` when no rule applies, so `bonusRule.compute(...)`
 * is always safe to call and always renders a real dollar amount ($0.00),
 * never blank/undefined.
 *
 * Disputes are note-only: a dispute is written as a `job_notes` row
 * (kind='dispute') via `ports.notes.create` and NEVER calls
 * `transitionJob`/`canTransitionJob` — filing a dispute must not change job
 * status. This screen does not import `domain/transition.ts` at all.
 *
 * ZERO status-transition writes — this screen only reads `job.status` for
 * display purposes.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile`.
 */
import type { Job, PayPeriod, BonusRule, Commission, Reimbursement, CloseOut } from '@jobcore/core';
export interface EarningsProps {
    /** The job this earnings breakdown belongs to. */
    job: Job;
    /** The pay period boundary this earnings breakdown covers. */
    period: PayPeriod;
    /** The bonus rule to apply; pass `NullBonusRule` when none applies. */
    bonusRule: BonusRule;
    /** Commissions for this job within the period. */
    commissions: Commission[];
    /** Reimbursements for this job within the period. */
    reimbursements: Reimbursement[];
    /** Pending-close-out state for this period's earnings. */
    closeOut: CloseOut;
}
/**
 * Earnings screen: derived hours, bonus (incl. `NullBonusRule` → $0.00),
 * commissions, reimbursements, pending-close-out state, and a note-only
 * dispute form. Never transitions job status.
 */
export declare function Earnings({ job, period, bonusRule, commissions, reimbursements, closeOut, }: EarningsProps): JSX.Element;
//# sourceMappingURL=Earnings.d.ts.map