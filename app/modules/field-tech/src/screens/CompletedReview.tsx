/**
 * Read-only view of a completion as it was approved. Shown by the
 * /job/complete/[jobId] route when the job is already complete: the saved
 * Job Checklist and Quality notes (job_notes), the after-photos (disabled),
 * and, when the host allows it, a "Not Completed" button that reopens the job.
 *
 * Field-tech isolation: ports come from `lib/module-ports.ts`; nothing is
 * imported from `apps/mobile`. Reopening is the host's `onReopen`.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import type { Job } from '@jobcore/core';
import { ScreenTitle, PayrollButton, colors, spacing, typography, Text } from '@jobcore/ui';

import { getModulePorts } from '../lib/module-ports';
import { formatTimeSpent } from './completion-helpers';

export interface CompletedReviewProps {
  /** The already-complete job. */
  job: Job;
  /** Total time spent on the job (stored seconds once completed). */
  timeSpentSeconds: number | null;
  /** Whether the "Not Completed" (reopen) button is shown. */
  canReopen: boolean;
  /** Reopens the job; the host navigates away on success. */
  onReopen: () => Promise<void>;
  /** Host-provided after-photo UI, rendered disabled. */
  renderAfterPhotos?: (api: { onCountChange: (n: number) => void; disabled: boolean }) => ReactNode;
}

export function CompletedReview({
  job,
  timeSpentSeconds,
  canReopen,
  onReopen,
  renderAfterPhotos,
}: CompletedReviewProps): JSX.Element {
  const [checklist, setChecklist] = useState<string | null>(null);
  const [qualityNotes, setQualityNotes] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const photoYRef = useRef(0);

  // Newest saved checklist / quality notes; best-effort, never written back.
  useEffect(() => {
    let cancelled = false;
    async function loadNotes(): Promise<void> {
      try {
        const notes = await getModulePorts().notes.listForJob(job.id);
        if (cancelled) return;
        const newest = (kind: 'completion_checklist' | 'quality_notes'): string | null => {
          const sorted = notes
            .filter((n) => n.kind === kind)
            .sort((a, b) => (b.occurredAt || b.createdAt).localeCompare(a.occurredAt || a.createdAt));
          return sorted[0]?.body ?? null;
        };
        setChecklist(newest('completion_checklist'));
        setQualityNotes(newest('quality_notes'));
      } catch {
        // read-only view is best-effort; the empty-state line shows instead
      }
    }
    void loadNotes();
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  async function handleReopen(): Promise<void> {
    setReopening(true);
    setError(null);
    try {
      await onReopen();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reopen job.');
      setReopening(false);
    }
  }

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <ScreenTitle title="Complete Job" />
        <Text style={styles.timeSpent}>{`Time Spent: ${formatTimeSpent(timeSpentSeconds)}`}</Text>
      </View>

      <View style={styles.buttonRow}>
        {canReopen ? (
          <PayrollButton
            label={reopening ? 'Reopening…' : 'Not Completed'}
            onPress={() => void handleReopen()}
            disabled={reopening}
          />
        ) : null}
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

      {checklist === null && qualityNotes === null ? (
        <Text style={styles.hint}>No saved checklist for this job.</Text>
      ) : null}

      {checklist !== null ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Job Checklist</Text>
          <Text style={styles.body}>{checklist}</Text>
        </View>
      ) : null}

      <View
        style={styles.section}
        onLayout={(e) => {
          photoYRef.current = e.nativeEvent.layout.y;
        }}
      >
        {renderAfterPhotos ? renderAfterPhotos({ onCountChange: () => undefined, disabled: true }) : null}
      </View>

      {qualityNotes !== null ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Quality notes</Text>
          <Text style={styles.body}>{qualityNotes}</Text>
        </View>
      ) : null}
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
    marginBottom: spacing.sm,
  },
  timeSpent: {
    fontSize: typography.size.body,
    color: colors.text,
    marginLeft: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heading: {
    fontSize: typography.size.body,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.size.body,
    color: colors.text,
  },
  hint: {
    fontSize: typography.size.label,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.size.label,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
});
