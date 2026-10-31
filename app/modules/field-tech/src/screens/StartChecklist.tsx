// JobCore screen #0030 - ft-StartChecklist - Start Checklist
/**
 * StartChecklist screen for the field-tech module (P4 Wave 3 slice S3.4).
 *
 * Covers the on-my-way / start / submit arc of a tech's day:
 * - On-my-way: `transitionJob(job, 'en_route', ctx)` — this module's sole
 *   call site for status transitions (see `domain/transition.ts`; never
 *   import `applyTransition` directly from `@jobcore/core`, enforced by the
 *   field-tech `.eslintrc.cjs` override).
 * - Start: instantiates a `checklist_instance` of kind `'start'` via
 *   `ChecklistRepository.createInstance`, pinning the template's CURRENT
 *   `version` at instantiation time (`ChecklistTemplate.version`), then lets
 *   the tech capture before-photos. Each before-photo is recorded through the
 *   offline mutation primitives in `@jobcore/core`'s `offline/queue`
 *   (`makeIdempotencyKey`, `NewQueuedMutation`) — mirroring the shape
 *   `offline/apply.ts`'s `applyOptimistic` uses for transitions — before the
 *   photo row is persisted via `JobPhotoRepository.create`. The mutation
 *   is computed only to mint the idempotency key; persistence goes through
 *   the repository's write-through path.
 * - Submit: submits the checklist instance's item answers via
 *   `ChecklistRepository.submitInstance`, THEN records the submission in the
 *   S1.4 sync-readable singleton (`recordStartChecklistSubmitted`) so
 *   `Ctx.hasSubmittedStartChecklist` reads synchronously true, THEN calls
 *   `transitionJob(job, 'in_progress', ctx)` — matching the plan's ordering
 *   ("submit → set S1.4 singleton then transitionJob(...,'in_progress',...)").
 *
 * Ties to spec AC5, VS2/3.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile` — mirrors the layering of
 * `modules/admin-finance/src/{index.ts,data/ports.ts,lib/module-session.ts}`.
 *
 * ZERO financial fields. This screen must never render or read anything
 * sourced from `price_sheets`, commissions, or payout data.
 */

import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Job } from '@jobcore/core';
import { makeIdempotencyKey } from '@jobcore/core';
import type { NewQueuedMutation } from '@jobcore/core';
import { ScreenTitle, PayrollButton, Checkbox, colors, spacing, typography, Text } from '@jobcore/ui';

import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { newPhotoId } from '../lib/photo-id';
import { transitionJob } from '../domain/transition';
import {
  recordStartChecklistSubmitted,
  hasSubmittedStartChecklist as readHasSubmittedStartChecklist,
} from '../lib/active-job-workflow-state';
import type { ChecklistInstance, ChecklistItem, ChecklistItemAnswerDraft } from '../data/ports';

export interface StartChecklistProps {
  /** The job the tech is starting work on. */
  job: Job;
  /** Called after the `in_progress` transition succeeds. */
  onDone: () => void;
}

/** Builds a nonce for `makeIdempotencyKey` without depending on a uuid library. */
function makeNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * StartChecklist screen: on-my-way transition, start-checklist instantiation
 * with before-photo capture via the offline queue, and submit (checklist
 * submit + S1.4 singleton + `in_progress` transition).
 */
export function StartChecklist({ job, onDone }: StartChecklistProps): JSX.Element {
  const [enRoute, setEnRoute] = useState(false);
  const [instance, setInstance] = useState<ChecklistInstance | null>(null);
  const [templateItems, setTemplateItems] = useState<ChecklistItem[]>([]);
  const [checkedLabels, setCheckedLabels] = useState<Set<string>>(new Set());
  const [beforePhotoCount, setBeforePhotoCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = getModuleSession();

  const handleOnMyWay = useCallback(async (): Promise<void> => {
    if (session === null) {
      setError('No active session — cannot go en route.');
      return;
    }
    setError(null);
    try {
      await transitionJob(job, 'en_route', {
        role: session.role,
        now: () => new Date().toISOString(),
      });
      setEnRoute(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to transition to en route.');
    }
  }, [job, session]);

  const handleStart = useCallback(async (): Promise<void> => {
    if (session === null || job.serviceId === null) {
      setError('No active session or job has no service — cannot start.');
      return;
    }
    setError(null);
    try {
      const ports = getModulePorts();
      const template = await ports.checklist.getTemplateForService(job.organizationId, job.serviceId);
      if (template === null) {
        setError('No checklist template found for this job.');
        return;
      }
      const created = await ports.checklist.createInstance(
        job.organizationId,
        job.id,
        template.id,
        template.version,
        'start',
      );
      const items = await ports.checklist.listTemplateItems(template.id);
      setInstance(created);
      setTemplateItems(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checklist.');
    }
  }, [job, session]);

  const handleToggleItem = useCallback((label: string): void => {
    setCheckedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const handleCaptureBeforePhoto = useCallback(
    async (storagePath: string, extra: { id: string; localUri: string; ext: string }): Promise<void> => {
      if (session === null) {
        setError('No active session — cannot capture photo.');
        return;
      }
      setError(null);
      try {
        const occurredAt = new Date().toISOString();
        const op = 'job_photo.create';
        const payload = JSON.stringify({ jobId: job.id, kind: 'before', storagePath });
        const mutation: NewQueuedMutation = {
          id: makeIdempotencyKey(op, occurredAt, makeNonce()),
          op,
          payload,
          occurredAt,
        };

        const ports = getModulePorts();
        await ports.photos.create(job.organizationId, {
          jobId: job.id,
          techId: session.userId,
          kind: 'before',
          storagePath,
          occurredAt,
          lat: null,
          lng: null,
          idempotencyKey: mutation.id,
          ...extra,
        } as never);
        setBeforePhotoCount((count) => count + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to capture before-photo.');
      }
    },
    [job, session],
  );

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (session === null || instance === null) {
      setError('Start the checklist before submitting.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ports = getModulePorts();
      const submittedAt = new Date().toISOString();
      const answers: ChecklistItemAnswerDraft[] = templateItems.map((item) => ({
        label: item.label,
        isChecked: checkedLabels.has(item.label),
        value: null,
        occurredAt: submittedAt,
      }));

      await ports.checklist.submitInstance(instance.id, answers, submittedAt);

      // S1.4 singleton FIRST, so Ctx.hasSubmittedStartChecklist reads
      // synchronously true before the transition's precondition check runs.
      recordStartChecklistSubmitted(job.id);

      await transitionJob(job, 'in_progress', {
        hasSubmittedStartChecklist: (j) => readHasSubmittedStartChecklist(j),
        role: session.role,
        now: () => new Date().toISOString(),
      });

      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit start checklist.');
    } finally {
      setSubmitting(false);
    }
  }, [job, session, instance, templateItems, checkedLabels, onDone]);

  if (session === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.body}>Sign in to start this job.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenTitle title="Start Checklist" />
      <Text style={styles.body}>Job {job.id}</Text>
      {error !== null ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      {!enRoute ? (
        <PayrollButton label="On my way" onPress={handleOnMyWay} style={styles.button} />
      ) : null}

      {enRoute && instance === null ? (
        <PayrollButton label="Start" onPress={handleStart} style={styles.button} />
      ) : null}

      {instance !== null ? (
        <View>
          <Text style={styles.body}>
            Checklist instance {instance.id} (template v{instance.templateVersion})
          </Text>

          <View style={styles.section}>
            <Text style={styles.body}>Before photos captured: {beforePhotoCount}</Text>
            <PayrollButton
              label="Capture before-photo"
              onPress={() => {
                void (async () => {
                  const ports = getModulePorts();
                  const photoId = newPhotoId();
                  const captured = await ports.camera.capturePhoto('before', { jobId: job.id, photoId });
                  if (captured) {
                    await handleCaptureBeforePhoto(captured.storagePath, { id: photoId, localUri: captured.localUri, ext: captured.ext });
                  }
                })();
              }}
              style={styles.button}
            />
          </View>

          <View style={styles.section}>
            {templateItems.map((item) => (
              <Checkbox
                key={item.id}
                label={item.label}
                checked={checkedLabels.has(item.label)}
                onChange={() => handleToggleItem(item.label)}
                style={styles.checkboxRow}
              />
            ))}
          </View>

          <PayrollButton
            label={submitting ? 'Submitting…' : 'Submit'}
            disabled={submitting}
            onPress={handleSubmit}
            style={styles.button}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  body: {
    fontSize: typography.size.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.size.label,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.sm,
  },
  button: {
    marginBottom: spacing.sm,
  },
  checkboxRow: {
    marginBottom: spacing.sm,
  },
});
