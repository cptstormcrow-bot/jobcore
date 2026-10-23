// JobCore screen #0024 - ft-Completion - Completion
/**
 * Completion screen for the field-tech module (P4 Wave 3 slice S3.5).
 *
 * Completion checklist + at least one after-photo + quality notes, then
 * `transitionJob(job, 'completed', ctx)` — this module's sole call site for
 * status transitions (see `domain/transition.ts`; never import
 * `applyTransition` directly from `@jobcore/core`, enforced by the
 * field-tech `.eslintrc.cjs` override).
 *
 * `ctx.hasAfterPhotos`/`ctx.hasQualityNotes` passed to `transitionJob` are
 * plain synchronous closures over this screen's own local state, read fresh
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

import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Job } from '@jobcore/core';
import { makeIdempotencyKey } from '@jobcore/core';
import { ScreenTitle, PayrollButton, Checkbox, TextField, colors, spacing, typography, Text } from '@jobcore/ui';

import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { newPhotoId } from '../lib/photo-id';
import { transitionJob } from '../domain/transition';
import { canSubmitCompletion } from './completion-helpers';
import {
  recordAfterPhoto,
  recordQualityNotes,
  hasAfterPhotos as readHasAfterPhotos,
  hasQualityNotes as readHasQualityNotes,
} from '../lib/active-job-workflow-state';

/** Builds a nonce for `makeIdempotencyKey` without depending on a uuid library. */
function makeNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function formatWorkedTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m worked`;
}

export interface CompletionProps {
  /** The job being completed. */
  job: Job;
  /** Called after the job has successfully transitioned to `completed`. */
  onDone: () => void;
  /** Optional: persist the transitioned job (awaited before `onDone`). */
  persistCompletion?: (job: Job) => Promise<void>;
}

/**
 * Completion screen: checklist + after-photo + quality notes, then
 * transitions the job to `completed`. Requires at least one after-photo
 * and non-empty quality notes client-side before enabling submit — this is
 * a UX guard only; the real gate is the core `completed` precondition.
 */
export function Completion({ job, onDone, persistCompletion }: CompletionProps): JSX.Element {
  const [checklistComplete, setChecklistComplete] = useState(false);
  const [afterPhotoCount, setAfterPhotoCount] = useState(0);
  const [qualityNotes, setQualityNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workedMinutes, setWorkedMinutes] = useState<number | null>(null);
  const notesSavedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkedTime(): Promise<void> {
      try {
        const ports = getModulePorts();
        const entries = await ports.timeEntries.listForJob(job.id);
        let totalMs = 0;
        for (const e of entries) {
          if (e.clockOutAt !== null) {
            totalMs += new Date(e.clockOutAt).getTime() - new Date(e.clockInAt).getTime();
          }
        }
        if (!cancelled) {
          setWorkedMinutes(Math.max(0, Math.round(totalMs / 60000)));
        }
      } catch {
        // worked-time lookup is best-effort; leave the field untouched on failure
      }
    }
    void loadWorkedTime();
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const trimmedNotes = qualityNotes.trim();
  const canSubmit = canSubmitCompletion({ checklistComplete, afterPhotoCount, notes: qualityNotes, submitting });

  /**
   * Gate: `canSubmitCompletion`. Submit records the quality note, runs the
   * state-machine transition, awaits optional `persistCompletion`, then
   * calls `onDone`. After-photo capture only records the fact of capture
   * against this module's ports/state — camera and storage upload wiring
   * lives in the host app's capture flow, out of this screen's scope.
   */
  async function handleCaptureAfterPhoto(storagePath: string, extra: { id: string; localUri: string; ext: string }): Promise<void> {
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
        ...extra,
      } as never);

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
      if (!notesSavedRef.current) {
        await ports.notes.create(job.organizationId, session.userId, {
          jobId: job.id,
          kind: 'quality_notes',
          body: trimmedNotes,
          occurredAt,
        });
        recordQualityNotes(job.id);
        notesSavedRef.current = true;
      }

      const transitioned = await transitionJob(job, 'completed', {
        hasAfterPhotos: (j) => readHasAfterPhotos(j),
        hasQualityNotes: (j) => readHasQualityNotes(j),
        role: session.role,
        now: () => new Date().toISOString(),
      });

      if (persistCompletion) {
        await persistCompletion(transitioned ?? job);
      }

      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete job.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenTitle title="Complete Job" />
      <Text style={styles.body}>Complete this job.</Text>

      <Checkbox
        label="Completion checklist done"
        checked={checklistComplete}
        onChange={() => setChecklistComplete((prev) => !prev)}
        disabled={submitting}
        style={styles.checkboxRow}
      />

      <View style={styles.section}>
        <PayrollButton
          label="Capture after-photo"
          onPress={() => {
            void (async () => {
              const ports = getModulePorts();
              const photoId = newPhotoId();
              const captured = await ports.camera.capturePhoto('after', { jobId: job.id, photoId });
              if (captured) {
                await handleCaptureAfterPhoto(captured.storagePath, { id: photoId, localUri: captured.localUri, ext: captured.ext });
              }
            })();
          }}
          disabled={submitting}
        />
        <Text style={styles.body}>{afterPhotoCount} after-photo(s) recorded</Text>
      </View>

      <TextField
        value={qualityNotes}
        onChangeText={setQualityNotes}
        placeholder="Quality notes"
        disabled={submitting}
        multiline
        style={styles.field}
      />

      <Text style={styles.body}>
        {workedMinutes !== null ? formatWorkedTime(workedMinutes) : 'Loading time worked…'}
      </Text>

      {error !== null ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <PayrollButton
        label={submitting ? 'Completing…' : 'Complete job'}
        onPress={() => void handleSubmit()}
        disabled={!canSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.size.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.size.label,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  button: {
    marginBottom: spacing.sm,
  },
  checkboxRow: {
    marginBottom: spacing.sm,
  },
});
