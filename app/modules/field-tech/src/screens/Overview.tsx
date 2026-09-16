/**
 * Overview screen for the field-tech module.
 *
 * A READ-ONLY dashboard rendered by the module's own SubView tab switch
 * (no props). It resolves session/ports via `lib/module-session.ts` and
 * `lib/module-ports.ts` — never constructs them locally — and pulls a small
 * set of count-based cards from the six field-tech repositories:
 * `jobs`, `timeOff`, `reimbursements`, `notes`, `photos`, `checklist`.
 *
 * No cross-module navigation mailbox exists, so no card wires a navigation
 * action — this screen is purely informational, and the module's own tab
 * row is the only navigation surface.
 *
 * `notes`, `photos`, and `checklist` only expose `listForJob(jobId)` /
 * `getInstanceForJob(jobId, kind)` (no tech-scoped list method), so their
 * counts are aggregated client-side across the tech's assigned jobs
 * (from `jobs.listAssignedToTech`) rather than fetched with a single call.
 */

import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import type { Job } from '@jobcore/core';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { colors } from '@jobcore/ui';

/** Job statuses that count as "closed out" — everything else counts as open. */
const CLOSED_JOB_STATUSES: ReadonlySet<Job['status']> = new Set([
  'completed',
  'paid',
  'closed',
  'declined',
  'cancelled',
]);

interface OverviewCounts {
  assignedJobs: number;
  openJobs: number;
  timeOffPending: number;
  timeOffApproved: number;
  reimbursementsPending: number;
  reimbursementsApproved: number;
  reimbursementsRejected: number;
  jobNotes: number;
  jobPhotos: number;
  checklistOpen: number;
  checklistSubmitted: number;
}

const EMPTY_COUNTS: OverviewCounts = {
  assignedJobs: 0,
  openJobs: 0,
  timeOffPending: 0,
  timeOffApproved: 0,
  reimbursementsPending: 0,
  reimbursementsApproved: 0,
  reimbursementsRejected: 0,
  jobNotes: 0,
  jobPhotos: 0,
  checklistOpen: 0,
  checklistSubmitted: 0,
};

/**
 * Overview screen: a read-only wrapping grid of count cards summarizing the
 * signed-in tech's assigned jobs, time off, reimbursements, notes, photos,
 * and checklist instances. No forms, no writes, no navigation.
 */
export function Overview(): React.ReactElement {
  const session = getModuleSession();

  const [counts, setCounts] = React.useState<OverviewCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const { jobs, timeOff, reimbursements, notes, photos, checklist } = getModulePorts();
    const techId = session.userId;

    async function load(): Promise<void> {
      const assignedJobs = await jobs.listAssignedToTech(techId);
      const openJobs = assignedJobs.filter((job) => !CLOSED_JOB_STATUSES.has(job.status));

      const [timeOffRequests, reimbursementRequests, notesByJob, photosByJob, checklistByJob] =
        await Promise.all([
          timeOff.listForTech(techId),
          reimbursements.listForTech(techId),
          Promise.all(assignedJobs.map((job) => notes.listForJob(job.id))),
          Promise.all(assignedJobs.map((job) => photos.listForJob(job.id))),
          Promise.all(
            assignedJobs.map((job) =>
              Promise.all([
                checklist.getInstanceForJob(job.id, 'start'),
                checklist.getInstanceForJob(job.id, 'completion'),
              ]),
            ),
          ),
        ]);

      const jobNotes = notesByJob.reduce((sum, list) => sum + list.length, 0);
      const jobPhotos = photosByJob.reduce((sum, list) => sum + list.length, 0);

      let checklistOpen = 0;
      let checklistSubmitted = 0;
      for (const [startInstance, completionInstance] of checklistByJob) {
        for (const instance of [startInstance, completionInstance]) {
          if (instance === null) {
            continue;
          }
          if (instance.submittedAt === null) {
            checklistOpen += 1;
          } else {
            checklistSubmitted += 1;
          }
        }
      }

      if (!cancelled) {
        setCounts({
          assignedJobs: assignedJobs.length,
          openJobs: openJobs.length,
          timeOffPending: timeOffRequests.filter((request) => request.status === 'pending').length,
          timeOffApproved: timeOffRequests.filter((request) => request.status === 'approved').length,
          reimbursementsPending: reimbursementRequests.filter((request) => request.status === 'pending')
            .length,
          reimbursementsApproved: reimbursementRequests.filter((request) => request.status === 'approved')
            .length,
          reimbursementsRejected: reimbursementRequests.filter((request) => request.status === 'rejected')
            .length,
          jobNotes,
          jobPhotos,
          checklistOpen,
          checklistSubmitted,
        });
      }
    }

    load()
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load overview.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (session === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Sign in to view your overview.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    );
  }

  if (loadError !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  const cards: Array<{ label: string; value: number }> = [
    { label: 'Assigned jobs', value: counts.assignedJobs },
    { label: 'Open jobs', value: counts.openJobs },
    { label: 'Time off pending', value: counts.timeOffPending },
    { label: 'Time off approved', value: counts.timeOffApproved },
    { label: 'Reimbursements pending', value: counts.reimbursementsPending },
    { label: 'Reimbursements approved', value: counts.reimbursementsApproved },
    { label: 'Reimbursements rejected', value: counts.reimbursementsRejected },
    { label: 'Job notes', value: counts.jobNotes },
    { label: 'Job photos', value: counts.jobPhotos },
    { label: 'Checklist open', value: counts.checklistOpen },
    { label: 'Checklist submitted', value: counts.checklistSubmitted },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.grid}>
        {cards.map((card) => (
          <View key={card.label} style={styles.card}>
            <Text style={styles.cardValue}>{card.value}</Text>
            <Text style={styles.cardLabel}>{card.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  card: {
    width: '48%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    margin: 4,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  cardLabel: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: 4,
  },
  emptyText: {
    color: colors.textMutedDark,
  },
  errorText: {
    color: colors.danger,
    marginTop: 8,
  },
});
