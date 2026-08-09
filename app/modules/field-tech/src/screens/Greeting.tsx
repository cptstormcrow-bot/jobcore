/**
 * Greeting screen for the field-tech module (P4 Wave 3 slice S3.1).
 *
 * Shown to a tech for a newly assigned job, offering accept/decline.
 * - Decline requires a non-empty reason: writes a `job_notes` row
 *   (kind='decline_reason', body=<reason>) via this module's `notes` port,
 *   THEN calls `transitionJob(job, 'declined', ctx)` — this module's sole
 *   call site for status transitions (see `domain/transition.ts`; never
 *   import `applyTransition` directly from `@jobcore/core`, enforced by the
 *   field-tech `.eslintrc.cjs` override).
 * - Accept is a passive acknowledgement only: per the plan, "silence leaves
 *   status untouched", so accept dismisses the greeting and proceeds onward
 *   without calling `transitionJob` or inventing a transition.
 *
 * Ties to spec AC2, VS1.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile` — mirrors the layering of
 * `modules/admin-finance/src/{index.ts,data/ports.ts,lib/module-session.ts}`.
 */

import { useState } from 'react';
import type { Job } from '@jobcore/core';

import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { transitionJob } from '../domain/transition';

export interface GreetingProps {
  /** The job the tech has been assigned and is being greeted for. */
  job: Job;
  /** Called after the tech accepts (passive — no status mutation) or after a decline transition succeeds. */
  onDone: () => void;
}

/**
 * Greeting screen: accept (passive, dismiss-only) or decline (requires a
 * non-empty reason, writes a job_notes row, then transitions the job).
 */
export function Greeting({ job, onDone }: GreetingProps): JSX.Element {
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedReason = reason.trim();
  const canSubmitDecline = trimmedReason.length > 0 && !submitting;

  /** Accept is passive: dismiss the greeting, never call transitionJob. */
  function handleAccept(): void {
    onDone();
  }

  async function handleDeclineSubmit(): Promise<void> {
    if (!canSubmitDecline) {
      return;
    }

    const session = getModuleSession();
    if (session === null) {
      setError('No active session — cannot decline.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ports = getModulePorts();
      const occurredAt = new Date().toISOString();

      await ports.notes.create(job.organizationId, session.userId, {
        jobId: job.id,
        kind: 'decline_reason',
        body: trimmedReason,
        occurredAt,
      });

      await transitionJob(job, 'declined', {
        role: session.role,
        now: () => new Date().toISOString(),
      });

      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to decline job.');
    } finally {
      setSubmitting(false);
    }
  }

  if (showDeclineForm) {
    return (
      <div>
        <p>Please tell us why you're declining this job.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for declining"
          disabled={submitting}
        />
        {error !== null ? <p role="alert">{error}</p> : null}
        <button
          type="button"
          onClick={() => {
            setShowDeclineForm(false);
            setReason('');
            setError(null);
          }}
          disabled={submitting}
        >
          Back
        </button>
        <button type="button" onClick={handleDeclineSubmit} disabled={!canSubmitDecline}>
          {submitting ? 'Submitting…' : 'Submit decline'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p>You've been assigned a new job.</p>
      <button type="button" onClick={handleAccept}>
        Accept
      </button>
      <button type="button" onClick={() => setShowDeclineForm(true)}>
        Decline
      </button>
    </div>
  );
}
