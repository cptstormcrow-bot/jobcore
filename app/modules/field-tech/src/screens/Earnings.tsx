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

import { useState } from 'react';
import type { Job, PayPeriod, BonusRule, Commission, Reimbursement, CloseOut, DerivedHours } from '@jobcore/core';

import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

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

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Derives this job's worked hours from device-clock `occurred_at` fields
 * (`inProgressAt` → `completedAt`), never from `syncedAt`/`synced_at`. If
 * either boundary is missing (job not yet started/completed), no hours are
 * derivable yet and `null` is returned.
 */
function deriveHours(job: Job): DerivedHours | null {
  if (job.inProgressAt === null || job.completedAt === null) {
    return null;
  }

  const from = job.inProgressAt;
  const to = job.completedAt;
  const hours = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60);

  return {
    jobId: job.id,
    from,
    to,
    hours: hours > 0 ? hours : 0,
  };
}

/**
 * Earnings screen: derived hours, bonus (incl. `NullBonusRule` → $0.00),
 * commissions, reimbursements, pending-close-out state, and a note-only
 * dispute form. Never transitions job status.
 */
export function Earnings({
  job,
  period,
  bonusRule,
  commissions,
  reimbursements,
  closeOut,
}: EarningsProps): JSX.Element {
  const [disputeText, setDisputeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedHours = deriveHours(job);
  const bonusAmount = bonusRule.compute(job, period);

  const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
  const totalReimbursements = reimbursements.reduce((sum, r) => sum + r.amount, 0);

  const trimmedDispute = disputeText.trim();
  const canSubmitDispute = trimmedDispute.length > 0 && !submitting;

  /**
   * Records a dispute as a note-only write against this job. Deliberately
   * does NOT call `transitionJob`/`canTransitionJob` — a dispute is a
   * comment, never a status change.
   */
  async function handleSubmitDispute(): Promise<void> {
    if (!canSubmitDispute) {
      return;
    }

    const session = getModuleSession();
    if (session === null) {
      setError('No active session — cannot record dispute.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ports = getModulePorts();
      const occurredAt = new Date().toISOString();

      await ports.notes.create(job.organizationId, session.userId, {
        jobId: job.id,
        kind: 'dispute',
        body: trimmedDispute,
        occurredAt,
      });

      setDisputeText('');
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record dispute.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p>Earnings for {period.start} – {period.end}</p>

      <section>
        <h3>Hours</h3>
        {derivedHours === null ? (
          <p>Hours not yet derivable — job has not completed.</p>
        ) : (
          <p>{derivedHours.hours.toFixed(2)} hours ({derivedHours.from} – {derivedHours.to})</p>
        )}
      </section>

      <section>
        <h3>Bonus</h3>
        <p>{bonusRule.description}</p>
        <p>{formatCurrency(bonusAmount)}</p>
      </section>

      <section>
        <h3>Commissions</h3>
        {commissions.length === 0 ? (
          <p>{formatCurrency(0)}</p>
        ) : (
          <ul>
            {commissions.map((c, i) => (
              <li key={`${c.jobId}-${i}`}>{formatCurrency(c.amount)}</li>
            ))}
          </ul>
        )}
        <p>Total: {formatCurrency(totalCommissions)}</p>
      </section>

      <section>
        <h3>Reimbursements</h3>
        {reimbursements.length === 0 ? (
          <p>{formatCurrency(0)}</p>
        ) : (
          <ul>
            {reimbursements.map((r, i) => (
              <li key={`${r.jobId}-${i}`}>{formatCurrency(r.amount)}</li>
            ))}
          </ul>
        )}
        <p>Total: {formatCurrency(totalReimbursements)}</p>
      </section>

      <section>
        <h3>Close-out</h3>
        {closeOut.closed ? (
          <p>
            Closed {closeOut.closedAt !== null ? `on ${closeOut.closedAt}` : ''}
            {closeOut.closedBy !== null ? ` by ${closeOut.closedBy}` : ''}
          </p>
        ) : (
          <p>Pending — this period has not been closed out yet.</p>
        )}
      </section>

      <section>
        <h3>Dispute</h3>
        <p>Filing a dispute records a note only — it does not change this job's status.</p>
        <textarea
          value={disputeText}
          onChange={(e) => setDisputeText(e.target.value)}
          placeholder="Describe the dispute"
          disabled={submitting}
        />
        {error !== null ? <p role="alert">{error}</p> : null}
        {submitted ? <p>Dispute recorded.</p> : null}
        <button type="button" onClick={() => void handleSubmitDispute()} disabled={!canSubmitDispute}>
          {submitting ? 'Submitting…' : 'Submit dispute'}
        </button>
      </section>
    </div>
  );
}
