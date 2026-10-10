// JobCore screen #0017 - af-closeOutQueue - Close-Outs
/**
 * Close-out queue screen (P3h.2).
 *
 * Close-out queue: shows every job grouped into a 3-way status view —
 * Unassigned, In Progress, Completed — per `closeout.ts`'s `closeOutStatus`,
 * each with the blocker reasons `closeOutBlockers` returns for it. This
 * screen is READ-ONLY — it surfaces the queue and blockers, it performs no
 * transition. Close actions are P3h.3b, out of scope here.
 *
 * `awaitingCloseOut`/`closeOutBlockers` do the membership test and the
 * `canTransition` call; this screen never restates the awaiting-close-out
 * status set as a literal and never compares `status === '...'`. It also
 * never imports `state-machine.ts` directly (ESLint `no-restricted-imports`,
 * P3-f, AC-4) and never calls `applyTransition`.
 *
 * Props-in/callbacks-out, mirroring `AssignmentBoardScreen.tsx`'s pattern:
 * this screen never imports sqlite/fetch/Supabase and never resolves `Ctx`
 * itself — the caller (which holds the repository and `Ctx`) hands both in
 * as props.
 *
 * Blocker reasons are rendered verbatim — no rewording, no wrapping, no
 * prettifying, no truncation — per `closeOutBlockers`'s own doc comment.
 *
 * Composed entirely from `@jobcore/ui` primitives; styled purely from
 * tokens — no raw color/spacing/typography literals.
 */

import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import type { Ctx, Job } from '@jobcore/core';
import { Card, EmptyState, ScreenTitle, colors, spacing, typography, Text } from '@jobcore/ui';
import { awaitingCloseOut, closeOutBlockers, closeOutStatus } from '../domain/closeout';
import type { CloseOutStatus } from '../domain/closeout';

export interface CloseOutQueueScreenProps {
  jobs: Job[];
  ctx: Ctx;
  /** Fired when a queue entry is selected, mirrors `LeadInboxScreen.tsx`'s `onSelectLead`. */
  onSelectJob?: (job: Job) => void;
  /** Customer id → display name, for the per-card "Customer" line. */
  customerNames?: Record<string, string>;
  /** Tech id → display name, for the per-card "Last worked" line. */
  techNames?: Record<string, string>;
}

interface QueueEntry {
  job: Job;
  blockers: string[];
}

const SECTIONS: { key: CloseOutStatus; label: string }[] = [
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export function CloseOutQueueScreen({
  jobs,
  ctx,
  onSelectJob,
  customerNames,
  techNames,
}: CloseOutQueueScreenProps) {
  const queue = useMemo<QueueEntry[]>(
    () =>
      jobs
        .filter(awaitingCloseOut)
        .map((job) => ({ job, blockers: closeOutBlockers(job, ctx) })),
    [jobs, ctx]
  );

  const grouped = useMemo(() => {
    const map: Record<CloseOutStatus, QueueEntry[]> = {
      unassigned: [],
      in_progress: [],
      completed: [],
    };
    for (const entry of queue) {
      map[closeOutStatus(entry.job)].push(entry);
    }
    return map;
  }, [queue]);

  if (queue.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Close-out queue" message="No jobs are awaiting close-out." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Close-Out Queue" />
      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map(({ key, label }) => {
          const entries = grouped[key];
          if (entries.length === 0) {
            return null;
          }
          return (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionHeader}>{label}</Text>
              {entries.map(({ job, blockers }) => {
                const lastWorked = job.completedAt ?? job.inProgressAt ?? '—';
                const techName = techNames?.[job.assignedTechId ?? ''] ?? 'Unassigned';
                const customerName = customerNames?.[job.customerId ?? ''] ?? 'Unknown customer';
                return (
                  <Pressable key={job.id} onPress={() => onSelectJob?.(job)}>
                    <Card style={styles.card}>
                      <Text style={styles.jobTitle}>{job.address ?? 'No address on file'}</Text>
                      <Text style={styles.jobCustomer}>Customer: {customerName}</Text>
                      <Text style={styles.jobStatus}>{job.status.replace(/_/g, ' ')}</Text>
                      <Text style={styles.jobLastWorked}>
                        Last worked: {lastWorked} · {techName}
                      </Text>
                      {blockers.length === 0 ? (
                        <Text style={styles.ready}>Ready to advance.</Text>
                      ) : (
                        blockers.map((reason, index) => (
                          <Text key={index} style={styles.blocker}>
                            {reason}
                          </Text>
                        ))
                      )}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default CloseOutQueueScreen;

/** Renders when no data is supplied — mirrors `AssignmentBoardScreenEmpty`'s no-data-source guard. */
export function CloseOutQueueScreenEmpty() {
  return (
    <View style={styles.screen}>
      <EmptyState title="Close-out queue" message="No jobs to show." />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  jobTitle: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  jobCustomer: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  jobStatus: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    textTransform: 'capitalize',
    marginBottom: spacing.sm,
  },
  jobLastWorked: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  ready: {
    color: colors.success,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
  },
  blocker: {
    color: colors.warning,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
});
