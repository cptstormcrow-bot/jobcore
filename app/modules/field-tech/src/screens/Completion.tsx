// JobCore screen #0024 - ft-Completion - Completion
/**
 * Completion screen for the field-tech module (P4 Wave 3 slice S3.5).
 *
 * 7-item Job Checklist + after-photos + quality notes, then
 * `transitionJob(job, 'completed', ctx)` — this module's sole call site for
 * status transitions (see `domain/transition.ts`; never import
 * `applyTransition` directly from `@jobcore/core`, enforced by the
 * field-tech `.eslintrc.cjs` override).
 *
 * After-photos arrive through the `renderAfterPhotos` slot (the host route
 * passes its photo card), which reports its count back via `onCountChange`.
 * The first count >= 1 calls `recordAfterPhoto` so the synchronous probe
 * (`lib/active-job-workflow-state.ts`, S1.4) reads true. `ctx.hasAfterPhotos`/
 * `ctx.hasQualityNotes` passed to `transitionJob` are plain synchronous
 * closures over that probe store; the quality-notes `job_notes` row
 * (kind='quality_notes') is written and `recordQualityNotes` called BEFORE
 * `transitionJob(...)`, so the `completed` precondition in
 * `packages/core/src/state-machine.ts` reads true.
 *
 * Ties to spec AC3, AC5, VS2.
 *
 * The screen's only financial effect is one fixed-fee Estimate line ($20
 * 'Materials not moved upstairs fee') when 'Materials moved upstairs' is
 * unticked. It still never renders anything sourced from `price_sheets`,
 * commissions, or payout data.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import type { Job } from '@jobcore/core';
import { PayrollButton, Checkbox, TextField, colors, spacing, typography, Text } from '@jobcore/ui';

import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { transitionJob } from '../domain/transition';
import {
  COMPLETION_CHECKLIST_ITEMS,
  UPSTAIRS_FEE,
  UPSTAIRS_FEE_DESCRIPTION,
  buildCompletionNoteBody,
  canSubmitCompletion,
  formatTimeSpent,
  upstairsFeeApplies,
} from './completion-helpers';
import type { CompletionItemKey } from './completion-helpers';
import {
  recordAfterPhoto,
  recordQualityNotes,
  hasAfterPhotos as readHasAfterPhotos,
  hasQualityNotes as readHasQualityNotes,
} from '../lib/active-job-workflow-state';

export interface CompletionProps {
  /** The job being completed. */
  job: Job;
  /** Called after the job has successfully transitioned to `completed`. */
  onDone: () => void;
  /** Optional: persist the transitioned job (awaited before `onDone`). */
  persistCompletion?: (job: Job) => Promise<void>;
  /** Total time spent on the job, computed once by the route (time stops at completion). */
  timeSpentSeconds?: number | null;
  /** Host-provided after-photo UI; call `onCountChange` with the current photo count. */
  renderAfterPhotos?: (api: { onCountChange: (n: number) => void; disabled: boolean }) => ReactNode;
}

/**
 * Completion screen: Job Checklist + after-photos + quality notes, then
 * transitions the job to `completed`. Client-side gate is `canSubmitCompletion`
 * — a UX guard only; the real gate is the core `completed` precondition.
 */
export function Completion({
  job,
  onDone,
  persistCompletion,
  timeSpentSeconds = null,
  renderAfterPhotos,
}: CompletionProps): JSX.Element {
  const [materialsOnsite, setMaterialsOnsite] = useState(false);
  const [movedUpstairs, setMovedUpstairs] = useState(false);
  const [damageChecked, setDamageChecked] = useState(false);
  const [damageText, setDamageText] = useState('');
  const [scopeChecked, setScopeChecked] = useState(false);
  const [scopeText, setScopeText] = useState('');
  const [buildsFinished, setBuildsFinished] = useState(false);
  const [debrisCleared, setDebrisCleared] = useState(false);
  const [afterPhotoCount, setAfterPhotoCount] = useState(0);
  const [photosTaken, setPhotosTaken] = useState(false);
  const [qualityNotes, setQualityNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const photoYRef = useRef(0);
  const photoRecordedRef = useRef(false);
  const notesSavedRef = useRef(false);
  const checklistSavedRef = useRef(false);
  const feeSavedRef = useRef(false);
  const feeAppliedRef = useRef(false);

  // Prefill "Materials onsite" from the job's estimate; best-effort, never written back.
  useEffect(() => {
    let cancelled = false;
    async function loadMaterialsOnsite(): Promise<void> {
      try {
        const estimate = await getModulePorts().estimates.getForJob(job.id);
        if (!cancelled && estimate !== null) {
          setMaterialsOnsite(estimate.materialsOnsite === true);
        }
      } catch {
        // prefill is best-effort; the tech can still tick the box by hand
      }
    }
    void loadMaterialsOnsite();
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  // Stable: the photo card calls this from an effect.
  const handleCountChange = useCallback(
    (n: number) => {
      setAfterPhotoCount(n);
      if (n >= 1 && !photoRecordedRef.current) {
        photoRecordedRef.current = true;
        recordAfterPhoto(job.id);
      }
    },
    [job.id],
  );

  const trimmedNotes = qualityNotes.trim();
  const canSubmit = canSubmitCompletion({
    buildsFinished,
    debrisCleared,
    afterPhotoCount: photosTaken ? Math.max(1, afterPhotoCount) : afterPhotoCount,
    notes: qualityNotes,
    submitting,
    damageChecked,
    damageText,
    scopeChecked,
    scopeText,
  });

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

      // (a) Quality notes MUST be written, and the sync probe MUST be updated,
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

      // The fee only applies when the job has an estimate to carry the line.
      const feeWanted = upstairsFeeApplies(movedUpstairs);
      let estimateExists = false;
      if (!checklistSavedRef.current || (feeWanted && !feeSavedRef.current)) {
        estimateExists = (await ports.estimates.getForJob(job.id)) !== null;
      }

      // (b) Checklist note.
      if (!checklistSavedRef.current) {
        feeAppliedRef.current = feeWanted && estimateExists;
        await ports.notes.create(job.organizationId, session.userId, {
          jobId: job.id,
          kind: 'completion_checklist',
          body: buildCompletionNoteBody({
            materialsOnsite,
            movedUpstairs,
            damageChecked,
            damageText,
            scopeChecked,
            scopeText,
            buildsFinished,
            debrisCleared,
            afterPhotoCount: photosTaken ? Math.max(1, afterPhotoCount) : afterPhotoCount,
            timeSpentSeconds,
            feeApplied: feeAppliedRef.current,
          }),
          occurredAt,
        });
        checklistSavedRef.current = true;
      }

      // (c) Upstairs fee line (skipped when already present or no estimate).
      if (feeWanted && estimateExists && !feeSavedRef.current) {
        const existing = await ports.estimates.listLineItems(job.id);
        if (!existing.some((line) => line.description === UPSTAIRS_FEE_DESCRIPTION)) {
          await ports.estimates.addLineItem(job.id, {
            kind: 'other',
            description: UPSTAIRS_FEE_DESCRIPTION,
            quantity: 1,
            unitCost: UPSTAIRS_FEE,
            lineTotal: UPSTAIRS_FEE,
          });
        }
        feeSavedRef.current = true;
      }

      // (d) State-machine transition.
      const transitioned = await transitionJob(job, 'completed', {
        hasAfterPhotos: (j) => readHasAfterPhotos(j),
        hasQualityNotes: (j) => readHasQualityNotes(j),
        role: session.role,
        now: () => new Date().toISOString(),
      });

      // (e) Persist, then (f) hand control back.
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

  function renderItem(key: CompletionItemKey, label: string, hint: string | undefined): JSX.Element {
    let checked = false;
    let onChange: () => void = () => undefined;
    let detail: ReactNode = null;
    let hintText = hint;

    switch (key) {
      case 'materialsOnsite':
        checked = materialsOnsite;
        onChange = () => setMaterialsOnsite((prev) => !prev);
        break;
      case 'movedUpstairs':
        checked = movedUpstairs;
        onChange = () => setMovedUpstairs((prev) => !prev);
        if (!movedUpstairs) {
          detail = <Text style={styles.hint}>{`A $${UPSTAIRS_FEE} fee will be added to the Estimate.`}</Text>;
        }
        break;
      case 'damage':
        checked = damageChecked;
        onChange = () => setDamageChecked((prev) => !prev);
        if (damageChecked) {
          detail = (
            <TextField
              value={damageText}
              onChangeText={setDamageText}
              placeholder="Describe the damage"
              disabled={submitting}
              multiline
              style={styles.field}
            />
          );
        }
        break;
      case 'extraScope':
        checked = scopeChecked;
        onChange = () => setScopeChecked((prev) => !prev);
        if (scopeChecked) {
          detail = (
            <TextField
              value={scopeText}
              onChangeText={setScopeText}
              placeholder="List each item added to the scope"
              disabled={submitting}
              multiline
              style={styles.field}
            />
          );
        }
        break;
      case 'buildsFinished':
        checked = buildsFinished;
        onChange = () => setBuildsFinished((prev) => !prev);
        if (buildsFinished) {
          detail = <Text style={styles.hint}>{`Total time elapsed: ${formatTimeSpent(timeSpentSeconds)}`}</Text>;
        }
        break;
      case 'debrisCleared':
        checked = debrisCleared;
        onChange = () => setDebrisCleared((prev) => !prev);
        break;
      case 'photosTaken':
        checked = photosTaken || afterPhotoCount >= 1;
        onChange = () => setPhotosTaken((p) => !p);
        hintText = `${afterPhotoCount} photo(s) - up to 6, each can carry a comment`;
        break;
    }

    return (
      <View key={key} style={styles.checkItem}>
        <Checkbox variant="tick" label={label} checked={checked} onChange={onChange} disabled={submitting} />
        {hintText ? <Text style={styles.hint}>{hintText}</Text> : null}
        {detail}
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.timeSpent}>{`Time Spent: ${formatTimeSpent(timeSpentSeconds)}`}</Text>
      </View>

      <View style={styles.buttonRow}>
        <PayrollButton
          label={submitting ? 'Completing…' : 'Complete Job'}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
        />
        <PayrollButton
          label="Completion Photos"
          onPress={() => scrollRef.current?.scrollTo({ y: photoYRef.current, animated: true })}
        />
      </View>

      {error !== null ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}

      <Text style={styles.heading}>Job Checklist</Text>
      {COMPLETION_CHECKLIST_ITEMS.map((item) => renderItem(item.key, item.label, item.hint))}

      <View
        style={styles.section}
        onLayout={(e) => {
          photoYRef.current = e.nativeEvent.layout.y;
        }}
      >
        {renderAfterPhotos ? renderAfterPhotos({ onCountChange: handleCountChange, disabled: submitting }) : null}
      </View>

      <TextField
        value={qualityNotes}
        onChangeText={setQualityNotes}
        placeholder="Quality notes"
        disabled={submitting}
        multiline
        style={styles.field}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  timeSpent: {
    fontSize: typography.size.body,
    color: colors.text,
    marginLeft: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  heading: {
    fontSize: typography.size.body,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  checkItem: {
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: typography.size.label,
    color: colors.textLight,
    marginLeft: spacing.lg,
  },
  section: {
    marginBottom: spacing.xs,
  },
  field: {
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.size.label,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
});
