/**
 * Completion screen for the field-tech module (P4 Wave 3 slice S3.5).
 *
 * Completion checklist + at least one after-photo + quality notes, then
 * `transitionJob(job, 'completed', ctx)` — this module's sole call site for
 * status transitions (see `domain/transition.ts`; never import
 * `applyTransition` directly from `@jobcore/core`, enforced by the
 * field-tech `.eslintrc.cjs` override).
 *
 * Ordering is load-bearing: the after-photo and quality-notes recorders
 * (`lib/active-job-workflow-state.ts`, S1.4) are called BEFORE
 * `transitionJob(...)` so that `ctx.hasAfterPhotos`/`ctx.hasQualityNotes`
 * read synchronously true when `canTransition`/`applyTransition` evaluate
 * the `completed` precondition in `packages/core/src/state-machine.ts`. The
 * quality-notes `job_notes` row (kind='quality_notes') is written first,
 * then `recordQualityNotes`/`recordAfterPhoto` update the in-memory probe
 * store, then `transitionJob` runs.
 *
 * Ties to spec AC3, AC5, VS2.
 *
 * ZERO financial fields — this screen never renders anything sourced from
 * `price_sheets`, commissions, or payout data.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile`.
 */

import { useState } from 'react';
import type { Job } from '@jobcore/core';
import { makeIdempotencyKey } from '@jobcore/core';
import { ScreenTitle } from '@jobcore/ui';

import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { transitionJob } from '../domain/transition';
import { recordAfterPhoto, recordQualityNotes } from '../lib/active-job-workflow-state';

/** Builds a nonce for `makeIdempotencyKey` without depending on a uuid library. */
function makeNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface CompletionProps {
  /** The job being completed. */
  job: Job;
  /** Called after the job has successfully transitioned to `completed`. */
  onDone: () => void;
}

/**
 * Completion screen: checklist + after-photo + quality notes, then
 * transitions the job to `completed`. Requires at least one after-photo
 * and non-empty quality notes client-side before enabling submit — this is
 * a UX guard only; the real gate is the core `completed` precondition.
 */
export function Completion({ job, onDone }: CompletionProps): JSX.Element {
  const [checklistComplete, setChecklistComplete] = useState(false);
  const [afterPhotoCount, setAfterPhotoCount] = useState(0);
  const [qualityNotes, setQualityNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedNotes = qualityNotes.trim();
  const canSubmit =
    checklistComplete && afterPhotoCount > 0 && trimmedNotes.length > 0 && !submitting;

  /**
   * Captures an after-photo. This screen only records the fact of capture
   * against this module's ports/state — actual camera capture and storage
   * upload wiring lives in the host app's capture flow, out of this
   * screen's scope.
   */
  async function handleCaptureAfterPhoto(storagePath: string): Promise<void> {
    const session = getModuleSession();
    if (session === null) {
      setError('No active session — cannot record photo.');
      return;
    }

    try {
      const ports = getModulePorts();
      const occurredAt = new Date().toISOString();
      const idempotencyKey = makeIdempotencyKey('job_photo.create', occurredAt, makeNonce());

      await ports.photos.create(job.organizationId, {
        jobId: job.id,
        techId: session.userId,
        kind: 'after',
        storagePath,
        occurredAt,
        lat: null,
        lng: null,
        idempotencyKey,
      });

      recordAfterPhoto(job.id);
      setAfterPhotoCount((count) => count + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record after-photo.');
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) {
      return;
    }

    const session = getModuleSession();
    if (session === null) {
      setError('No active session — cannot complete job.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ports = getModulePorts();
      const occurredAt = new Date().toISOString();

      // Quality notes MUST be written, and the sync probe MUST be updated,
      // before transitionJob runs — the core's `completed` precondition
      // reads ctx.hasQualityNotes(job) synchronously during the call below.
      await ports.notes.create(job.organizationId, session.userId, {
        jobId: job.id,
        kind: 'quality_notes',
        body: trimmedNotes,
        occurredAt,
      });
      recordQualityNotes(job.id);

      await transitionJob(job, 'completed', {
        role: session.role,
        now: () => new Date().toISOString(),
      });

      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete job.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <ScreenTitle title="Complete Job" />
      <p>Complete this job.</p>

      <label>
        <input
          type="checkbox"
          checked={checklistComplete}
          onChange={(e) => setChecklistComplete(e.target.checked)}
          disabled={submitting}
        />
        Completion checklist done
      </label>

      <div>
        <button
          type="button"
          onClick={() => {
            void (async () => {
              const ports = getModulePorts();
              const captured = await ports.camera.capturePhoto('after');
              if (captured) {
                await handleCaptureAfterPhoto(captured.storagePath);
              }
            })();
          }}
          disabled={submitting}
        >
          Capture after-photo
        </button>
        <p>{afterPhotoCount} after-photo(s) recorded</p>
      </div>

      <textarea
        value={qualityNotes}
        onChange={(e) => setQualityNotes(e.target.value)}
        placeholder="Quality notes"
        disabled={submitting}
      />

      {error !== null ? <p role="alert">{error}</p> : null}

      <button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
        {submitting ? 'Completing…' : 'Complete job'}
      </button>
    </div>
  );
}
