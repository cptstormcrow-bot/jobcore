// JobCore screen #0054 - ft-Overview - Overview
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
import { useReadCacheRevision } from '../lib/read-cache';
import { View, StyleSheet, Pressable } from 'react-native';

import type { Job } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { CLOSED_JOB_STATUSES } from './day-list-helpers';
import { colors, spacing, Text } from '@jobcore/ui';

/** Same pref key the Jobs screen (DayList) uses for showing test jobs. */
const SHOW_TEST_JOBS_KEY = 'field-tech.jobs.show-test-jobs';

export interface OverviewProps {
  onOpenJob?: (jobId: string) => void;
  onOpenTimeOff?: () => void;
  onDrillChange?: (drillLabel: string | null) => void;
  onOpenJobs?: () => void;
  showTestJobs?: boolean;
}

type TileKey =
  | 'assigned'
  | 'open'
  | 'timeOffPending'
  | 'timeOffApproved'
  | 'reimbPending'
  | 'reimbApproved'
  | 'reimbRejected'
  | 'notes'
  | 'photos'
  | 'checklistOpen'
  | 'checklistSubmitted'
  | 'premsClaimed';

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
export function Overview({
  onOpenJob,
  onOpenTimeOff,
  onDrillChange,
  onOpenJobs,
  showTestJobs: showTestJobsProp,
}: OverviewProps = {}): React.ReactElement {
  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = React.useRef(false);

  const [counts, setCounts] = React.useState<OverviewCounts>(EMPTY_COUNTS);
  const [jobLists, setJobLists] = React.useState<Record<string, Job[]>>({});
  const [activeTile, setActiveTile] = React.useState<{ key: TileKey; label: string } | null>(null);
  const [premsClaimed, setPremsClaimed] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const activeDrillLabel = activeTile ? activeTile.label : null;
  React.useEffect(() => {
    onDrillChange?.(activeDrillLabel);
    return () => {
      onDrillChange?.(null);
    };
  }, [activeDrillLabel, onDrillChange]);

  React.useEffect(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    if (!hasLoadedRef.current) setLoading(true);
    hasLoadedRef.current = true;
    setLoadError(null);

    const { jobs, timeOff, reimbursements, notes, photos, checklist } = getModulePorts();
    const techId = session.userId;

    async function load(): Promise<void> {
      const allAssignedJobs = await jobs.listAssignedToTech(techId);
      const showTestJobs =
        showTestJobsProp ?? (await getModulePorts().localPrefs.getBool(SHOW_TEST_JOBS_KEY, false));
      let claimed: number | null = null;
      try {
        const premResult = await getModulePorts().premQueue.listOpen(techId);
        claimed = premResult.unavailable ? null : premResult.items.filter((item) => item.claimedByMe === true).length;
      } catch {
        claimed = null;
      }
      const assignedJobs = allAssignedJobs
        .filter((job) => isBetaVisible(job, showTestJobs));
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

      const pick = (flags: boolean[]): Job[] => assignedJobs.filter((_, i) => flags[i]);
      const lists: Record<string, Job[]> = {
        assigned: assignedJobs,
        open: openJobs,
        notes: pick(notesByJob.map((l) => l.length > 0)),
        photos: pick(photosByJob.map((l) => l.length > 0)),
        checklistOpen: pick(checklistByJob.map((pair) => pair.some((x) => x !== null && x.submittedAt === null))),
        checklistSubmitted: pick(checklistByJob.map((pair) => pair.some((x) => x !== null && x.submittedAt !== null))),
      };

      if (!cancelled) {
        setJobLists(lists);
        setPremsClaimed(claimed);
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
  }, [session, showTestJobsProp, rev]);

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

  const groups: Array<{
    key: string;
    title: string;
    stats: Array<{ key: TileKey; label: string; drillLabel: string; value: number | string }>;
  }> = [
    {
      key: 'jobs',
      title: 'Jobs',
      stats: [
        { key: 'assigned', label: 'Assigned', drillLabel: 'Assigned jobs', value: counts.assignedJobs },
        { key: 'open', label: 'Open', drillLabel: 'Open jobs', value: counts.openJobs },
      ],
    },
    {
      key: 'premsClaimed',
      title: 'Prems Claimed',
      stats: [
        {
          key: 'premsClaimed',
          label: 'Claimed',
          drillLabel: 'Prems claimed',
          value: premsClaimed === null ? '—' : premsClaimed,
        },
      ],
    },
    {
      key: 'timeOff',
      title: 'Time Off',
      stats: [
        { key: 'timeOffPending', label: 'Pending', drillLabel: 'Time off pending', value: counts.timeOffPending },
        { key: 'timeOffApproved', label: 'Approved', drillLabel: 'Time off approved', value: counts.timeOffApproved },
      ],
    },
    {
      key: 'reimbursements',
      title: 'Reimbursements',
      stats: [
        { key: 'reimbPending', label: 'Pending', drillLabel: 'Reimbursements pending', value: counts.reimbursementsPending },
        { key: 'reimbApproved', label: 'Approved', drillLabel: 'Reimbursements approved', value: counts.reimbursementsApproved },
        { key: 'reimbRejected', label: 'Rejected', drillLabel: 'Reimbursements rejected', value: counts.reimbursementsRejected },
      ],
    },
    {
      key: 'notes',
      title: 'Notes',
      stats: [{ key: 'notes', label: 'Job notes', drillLabel: 'Job notes', value: counts.jobNotes }],
    },
    {
      key: 'photos',
      title: 'Photos',
      stats: [{ key: 'photos', label: 'Job photos', drillLabel: 'Job photos', value: counts.jobPhotos }],
    },
    {
      key: 'checklist',
      title: 'Checklist',
      stats: [
        { key: 'checklistOpen', label: 'Open', drillLabel: 'Checklist open', value: counts.checklistOpen },
        { key: 'checklistSubmitted', label: 'Submitted', drillLabel: 'Checklist submitted', value: counts.checklistSubmitted },
      ],
    },
  ];

  if (activeTile !== null) {
    const rows = jobLists[activeTile.key] ?? [];
    return (
      <View style={styles.container}>
        <Pressable onPress={() => setActiveTile(null)} style={styles.row}>
          <Text style={styles.cardLabel}>‹ Back to overview</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>{activeTile.label}</Text>
        {rows.length === 0 ? <Text style={styles.emptyText}>No jobs.</Text> : null}
        {rows.map((job) => (
          <Pressable key={job.id} onPress={() => onOpenJob?.(job.id)} style={styles.row}>
            <Text style={styles.cardValue}>
              {job.jobNumber != null ? `#${job.jobNumber}` : 'Job'} {job.customerName ?? ''}
            </Text>
            <Text style={styles.cardLabel}>{job.address ?? ''}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {groups.map((group) => (
        <View key={group.key} style={styles.groupCard}>
          {group.key === 'jobs' ? (
            <Pressable onPress={() => onOpenJobs?.()} accessibilityRole="button" accessibilityLabel="Open assigned jobs">
              <Text style={styles.groupTitle}>{group.title}</Text>
            </Pressable>
          ) : (
            <Text style={styles.groupTitle}>{group.title}</Text>
          )}
          <View style={styles.statsRow}>
            {group.stats.map((s) => (
              <Pressable
                key={s.key}
                style={styles.stat}
                onPress={() => {
                  if (s.key === 'timeOffPending' || s.key === 'timeOffApproved') {
                    onOpenTimeOff?.();
                  } else if (s.key === 'premsClaimed') {
                    // No Prems route from Overview; intentionally non-navigating.
                  } else {
                    setActiveTile({ key: s.key, label: s.drillLabel });
                  }
                }}
              >
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  groupCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: 2,
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
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 10,
  },
  emptyText: {
    color: colors.textMutedDark,
  },
  errorText: {
    color: colors.danger,
    marginTop: 8,
  },
});
