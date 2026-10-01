/**
 * Overview screen for the field-tech module.
 *
 * A READ-ONLY dashboard rendered by the module's own SubView tab switch
 * (no props). It resolves session/ports via `lib/module-session.ts` and
 * `lib/module-ports.ts` — never constructs them locally — and pulls a small
 * set of count-based cards from the six field-tech repositories:
 * `jobs`, `timeOff`, `reimbursements`, `notes`, `photos`, `checklist`.
 *
 * Navigation is delegated to optional OverviewProps callbacks; tapping a tile
 * toggles an inline drill-down list and tapping an item calls its callback.
 *
 * `notes`, `photos`, and `checklist` only expose `listForJob(jobId)` /
 * `getInstanceForJob(jobId, kind)` (no tech-scoped list method), so their
 * counts are aggregated client-side across the tech's assigned jobs
 * (from `jobs.listAssignedToTech`) rather than fetched with a single call.
 */

import * as React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import type { Job } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import type { ReimbursementRequest, TimeOffRequest } from '../data/ports';
import { colors, Select, Text } from '@jobcore/ui';

/** Same pref key the Jobs screen (DayList) uses for showing test jobs. */
const SHOW_TEST_JOBS_KEY = 'field-tech.jobs.show-test-jobs';

/** Job statuses that count as "closed out" — everything else counts as open. */
const CLOSED_JOB_STATUSES: ReadonlySet<Job['status']> = new Set([
  'completed',
  'paid',
  'closed',
  'declined',
  'cancelled',
]);

/** Optional navigation callbacks wired by the module root. */
export interface OverviewProps {
  onOpenJob?: (jobId: string) => void;
  onOpenTimeOff?: (requestId?: string) => void;
  onOpenReimbursements?: () => void;
}

export interface OverviewCounts {
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

/** Inputs for {@link computeOverviewCounts}; per-job arrays align with `jobs`. */
export interface OverviewCountInputs {
  jobs: readonly Job[];
  timeOff: readonly { status: string }[];
  reimbursements: readonly { status: string }[];
  /** Note count per job (same order as `jobs`). */
  notesPerJob: readonly number[];
  /** Photo count per job (same order as `jobs`). */
  photosPerJob: readonly number[];
  /** Per job: [open, submitted] checklist instance counts. */
  checklistPerJob: readonly (readonly [number, number])[];
}

/** Pure: derives every Overview tile count. No React, no hooks. */
export function computeOverviewCounts(input: OverviewCountInputs): OverviewCounts {
  const countStatus = (list: readonly { status: string }[], status: string): number =>
    list.filter((item) => item.status === status).length;
  let checklistOpen = 0;
  let checklistSubmitted = 0;
  for (const [open, submitted] of input.checklistPerJob) {
    checklistOpen += open;
    checklistSubmitted += submitted;
  }
  return {
    assignedJobs: input.jobs.length,
    openJobs: input.jobs.filter((job) => !CLOSED_JOB_STATUSES.has(job.status)).length,
    timeOffPending: countStatus(input.timeOff, 'pending'),
    timeOffApproved: countStatus(input.timeOff, 'approved'),
    reimbursementsPending: countStatus(input.reimbursements, 'pending'),
    reimbursementsApproved: countStatus(input.reimbursements, 'approved'),
    reimbursementsRejected: countStatus(input.reimbursements, 'rejected'),
    jobNotes: input.notesPerJob.reduce((sum, n) => sum + n, 0),
    jobPhotos: input.photosPerJob.reduce((sum, n) => sum + n, 0),
    checklistOpen,
    checklistSubmitted,
  };
}

interface OverviewData {
  jobs: Job[];
  timeOff: TimeOffRequest[];
  reimbursements: ReimbursementRequest[];
  notesPerJob: number[];
  photosPerJob: number[];
  checklistPerJob: [number, number][];
}

const EMPTY_DATA: OverviewData = {
  jobs: [],
  timeOff: [],
  reimbursements: [],
  notesPerJob: [],
  photosPerJob: [],
  checklistPerJob: [],
};

type TileKey = keyof OverviewCounts;

function jobDate(job: Job): string {
  return job.scheduledStart === null ? 'Unscheduled' : job.scheduledStart.slice(0, 10);
}

/**
 * Overview screen: a wrapping grid of tappable count tiles. Owner/admin see
 * every org job on every date (with a tech picker); a tech sees their own
 * jobs on every date. Tapping a tile toggles an inline list of the items
 * behind the count; tapping an item calls the matching optional callback.
 */
export function Overview(props: OverviewProps = {}): React.ReactElement {
  const { onOpenJob, onOpenTimeOff, onOpenReimbursements } = props;
  const session = getModuleSession();
  const isAdmin = session !== null && (session.role === 'owner' || session.role === 'admin');

  const [data, setData] = React.useState<OverviewData>(EMPTY_DATA);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = React.useState<string>('');
  const [techs, setTechs] = React.useState<{ id: string; label: string }[]>([]);
  const [openTile, setOpenTile] = React.useState<TileKey | null>(null);

  React.useEffect(() => {
    if (session === null || !isAdmin) return;
    let cancelled = false;
    getModulePorts()
      .techs.list(session.org.id)
      .then((result) => {
        if (cancelled) return;
        setTechs(
          result
            .filter((t) => t.role === 'tech' && t.active === true)
            .map((t) => ({ id: t.id, label: t.isTest === true ? `${t.fullName} (test)` : t.fullName })),
        );
      })
      .catch(() => {
        /* non-fatal: picker simply shows "All techs" only */
      });
    return () => {
      cancelled = true;
    };
  }, [session, isAdmin]);

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
    const pickedTechId = selectedTechId === '' ? undefined : selectedTechId;

    async function load(): Promise<void> {
      if (session === null) return;
      const allJobs = isAdmin
        ? await jobs.listForOrg(session.org.id, pickedTechId)
        : await jobs.listAssignedToTech(techId);
      const showTestJobs = await getModulePorts().localPrefs.getBool(SHOW_TEST_JOBS_KEY, false);
      const visibleJobs = allJobs.filter((job) => isBetaVisible(job, showTestJobs));

      const [timeOffRequests, reimbursementRequests, notesByJob, photosByJob, checklistByJob] =
        await Promise.all([
          isAdmin
            ? timeOff
                .listForOrg(session.org.id)
                .then((all) => all.filter((r) => pickedTechId === undefined || r.techId === pickedTechId))
            : timeOff.listForTech(techId),
          isAdmin ? reimbursements.listForOrg(session.org.id, pickedTechId) : reimbursements.listForTech(techId),
          Promise.all(visibleJobs.map((job) => notes.listForJob(job.id))),
          Promise.all(visibleJobs.map((job) => photos.listForJob(job.id))),
          Promise.all(
            visibleJobs.map((job) =>
              Promise.all([
                checklist.getInstanceForJob(job.id, 'start'),
                checklist.getInstanceForJob(job.id, 'completion'),
              ]),
            ),
          ),
        ]);

      const checklistPerJob = checklistByJob.map((pair): [number, number] => {
        let open = 0;
        let submitted = 0;
        for (const instance of pair) {
          if (instance === null) continue;
          if (instance.submittedAt === null) open += 1;
          else submitted += 1;
        }
        return [open, submitted];
      });

      if (!cancelled) {
        setData({
          jobs: visibleJobs,
          timeOff: timeOffRequests,
          reimbursements: reimbursementRequests,
          notesPerJob: notesByJob.map((list) => list.length),
          photosPerJob: photosByJob.map((list) => list.length),
          checklistPerJob,
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
  }, [session, isAdmin, selectedTechId]);

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

  const counts = computeOverviewCounts(data) ?? EMPTY_COUNTS;

  const jobsWhere = (keep: (index: number) => boolean): Job[] => data.jobs.filter((_, index) => keep(index));
  const jobItems: Partial<Record<TileKey, Job[]>> = {
    assignedJobs: data.jobs,
    openJobs: data.jobs.filter((job) => !CLOSED_JOB_STATUSES.has(job.status)),
    jobNotes: jobsWhere((i) => (data.notesPerJob[i] ?? 0) > 0),
    jobPhotos: jobsWhere((i) => (data.photosPerJob[i] ?? 0) > 0),
    checklistOpen: jobsWhere((i) => (data.checklistPerJob[i]?.[0] ?? 0) > 0),
    checklistSubmitted: jobsWhere((i) => (data.checklistPerJob[i]?.[1] ?? 0) > 0),
  };
  const timeOffItems: Partial<Record<TileKey, TimeOffRequest[]>> = {
    timeOffPending: data.timeOff.filter((r) => r.status === 'pending'),
    timeOffApproved: data.timeOff.filter((r) => r.status === 'approved'),
  };
  const reimbItems: Partial<Record<TileKey, ReimbursementRequest[]>> = {
    reimbursementsPending: data.reimbursements.filter((r) => r.status === 'pending'),
    reimbursementsApproved: data.reimbursements.filter((r) => r.status === 'approved'),
    reimbursementsRejected: data.reimbursements.filter((r) => r.status === 'rejected'),
  };

  const cards: Array<{ key: TileKey; label: string }> = [
    { key: 'assignedJobs', label: 'Assigned jobs' },
    { key: 'openJobs', label: 'Open jobs' },
    { key: 'timeOffPending', label: 'Time off pending' },
    { key: 'timeOffApproved', label: 'Time off approved' },
    { key: 'reimbursementsPending', label: 'Reimbursements pending' },
    { key: 'reimbursementsApproved', label: 'Reimbursements approved' },
    { key: 'reimbursementsRejected', label: 'Reimbursements rejected' },
    { key: 'jobNotes', label: 'Job notes' },
    { key: 'jobPhotos', label: 'Job photos' },
    { key: 'checklistOpen', label: 'Checklist open' },
    { key: 'checklistSubmitted', label: 'Checklist submitted' },
  ];

  const openCard = cards.find((card) => card.key === openTile);
  const openJobsList = openTile === null ? undefined : jobItems[openTile];
  const openTimeOffList = openTile === null ? undefined : timeOffItems[openTile];
  const openReimbList = openTile === null ? undefined : reimbItems[openTile];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Overview</Text>
      {isAdmin ? (
        <Select
          value={selectedTechId}
          options={[{ label: 'All techs', value: '' }, ...techs.map((t) => ({ label: t.label, value: t.id }))]}
          onChange={setSelectedTechId}
        />
      ) : null}
      <View style={styles.grid}>
        {cards.map((card) => (
          <Pressable
            key={card.key}
            accessibilityRole="button"
            accessibilityLabel={`${card.label}: ${counts[card.key]}`}
            onPress={() => setOpenTile((current) => (current === card.key ? null : card.key))}
            style={styles.card}
          >
            <Text style={styles.cardValue}>{counts[card.key]}</Text>
            <Text style={styles.cardLabel}>{card.label}</Text>
          </Pressable>
        ))}
      </View>
      {openCard !== undefined ? (
        <View style={styles.list}>
          <Text style={styles.sectionTitle}>{openCard.label}</Text>
          {openJobsList !== undefined && openJobsList.length === 0 ? <Text style={styles.emptyText}>Nothing here.</Text> : null}
          {openTimeOffList !== undefined && openTimeOffList.length === 0 ? <Text style={styles.emptyText}>Nothing here.</Text> : null}
          {openReimbList !== undefined && openReimbList.length === 0 ? <Text style={styles.emptyText}>Nothing here.</Text> : null}
          {(openJobsList ?? []).map((job) => (
            <Pressable
              key={job.id}
              accessibilityRole="button"
              onPress={() => onOpenJob?.(job.id)}
              style={styles.row}
            >
              <Text style={styles.rowTitle}>
                {job.jobNumber === null || job.jobNumber === undefined ? 'No job number' : `#${job.jobNumber}`}
              </Text>
              <Text style={styles.rowMeta}>{job.customerName ?? 'No customer'}</Text>
              <Text style={styles.rowMeta}>{job.address ?? 'No address'}</Text>
              <Text style={styles.rowMeta}>{`${jobDate(job)} · ${job.status}`}</Text>
            </Pressable>
          ))}
          {(openTimeOffList ?? []).map((request) => (
            <Pressable
              key={request.id}
              accessibilityRole="button"
              onPress={() => onOpenTimeOff?.(request.id)}
              style={styles.row}
            >
              <Text style={styles.rowTitle}>{`${request.startDate} – ${request.endDate}`}</Text>
              <Text style={styles.rowMeta}>{request.status}</Text>
            </Pressable>
          ))}
          {(openReimbList ?? []).map((request) => (
            <Pressable
              key={request.id}
              accessibilityRole="button"
              onPress={() => onOpenReimbursements?.()}
              style={styles.row}
            >
              <Text style={styles.rowTitle}>{`$${(request.amountCents / 100).toFixed(2)}`}</Text>
              <Text style={styles.rowMeta}>{request.status}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
  list: {
    marginTop: 16,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textMutedDark,
  },
  errorText: {
    color: colors.danger,
    marginTop: 8,
  },
});

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
