/**
 * Close-out queue screen (P3h.2).
 *
 * Awaiting-close-out queue: shows every job `closeout.ts`'s `awaitingCloseOut`
 * reports (`completed`/`paid`, not yet `closed`), each with the blocker
 * reasons `closeOutBlockers` returns for it. This screen is READ-ONLY — it
 * surfaces the queue and blockers, it performs no transition. Close actions
 * are P3h.3b, out of scope here.
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
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import type { Ctx, Job } from '@jobcore/core';
import { Card, EmptyState, colors, spacing, typography } from '@jobcore/ui';
import { awaitingCloseOut, closeOutBlockers } from '../domain/closeout';

export interface CloseOutQueueScreenProps {
  jobs: Job[];
  ctx: Ctx;
  /** Fired when a queue entry is selected, mirrors `LeadInboxScreen.tsx`'s `onSelectLead`. */
  onSelectJob?: (job: Job) => void;
}

interface QueueEntry {
  job: Job;
  blockers: string[];
}

export function CloseOutQueueScreen({ jobs, ctx, onSelectJob }: CloseOutQueueScreenProps) {
  const queue = useMemo<QueueEntry[]>(
    () =>
      jobs
        .filter(awaitingCloseOut)
        .map((job) => ({ job, blockers: closeOutBlockers(job, ctx) })),
    [jobs, ctx]
  );

  if (queue.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Close-out queue" message="No jobs are awaiting close-out." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {queue.map(({ job, blockers }) => (
          <Pressable key={job.id} onPress={() => onSelectJob?.(job)}>
            <Card style={styles.card}>
              <Text style={styles.jobTitle}>{job.address ?? 'No address on file'}</Text>
              <Text style={styles.jobStatus}>{job.status.replace(/_/g, ' ')}</Text>
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
        ))}
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
  jobStatus: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    textTransform: 'capitalize',
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
