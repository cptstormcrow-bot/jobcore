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
import { View, StyleSheet, Pressable } from 'react-native';

import type { Job } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import type { ReimbursementRequest, TimeOffRequest } from '../data/ports';
import { colors, Select, Text } from '@jobcore/ui';
import { CLOSED_JOB_STATUSES, EMPTY_COUNTS, computeOverviewCounts, type OverviewCounts } from './overview-helpers';

/** Same pref key the Jobs screen (DayList) uses for showing test jobs. */
const SHOW_TEST_JOBS_KEY = 'field-tech.jobs.show-test-jobs';

export interface OverviewProps {
  onOpenJob?: (jobId: string) => void;
  onOpenTimeOff?: (requestId?: string) => void;
  onOpenReimbursements?: () => void;
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
  | 'checklistSubmitted';

// Re-exported so importers of `./Overview` keep resolving the count helpers.
export { computeOverviewCounts } from './overview-helpers';
export type { OverviewCounts, OverviewCountInputs } from './overview-helpers';

function jobDate(job: Job): string {
  return job.scheduledStart === null ? 'Unscheduled' : job.scheduledStart.slice(0, 10);
}

/**
 * Overview screen: a read-only wrapping grid of count cards summarizing the
 * signed-in tech's assigned jobs, time off, reimbursements, notes, photos,
 * and checklist instances. No forms, no writes, no navigation.
 */
export function Overview({ onOpenJob, onOpenTimeOff, onOpenReimbursements }: OverviewProps = {}): React.ReactElement {
  const session = getModuleSession();
  const isAdmin = session !== null && (session.role === 'owner' || session.role === 'admin');

  const [counts, setCounts] = React.useState<OverviewCounts>(EMPTY_COUNTS);
  const [jobLists, setJobLists] = React.useState<Record<string, Job[]>>({});
  const [activeTile, setActiveTile] = React.useState<{ key: TileKey; label: string } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [timeOffList, setTimeOffList] = React.useState<TimeOffRequest[]>([]);
  const [reimbList, setReimbList] = React.useState<ReimbursementRequest[]>([]);
  const [selectedTechId, setSelectedTechId] = React.useState<string>('');
  const [techs, setTechs] = React.useState<{ id: string; label: string }[]>([]);

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
      const allAssignedJobs = isAdmin
        ? await jobs.listForOrg(session.org.id, pickedTechId)
        : await jobs.listAssignedToTech(techId);
      const showTestJobs = await getModulePorts().localPrefs.getBool(SHOW_TEST_JOBS_KEY, false);
      const assignedJobs = allAssignedJobs
        .filter((job) => isBetaVisible(job, showTestJobs));
      const openJobs = assignedJobs.filter((job) => !CLOSED_JOB_STATUSES.has(job.status));

      const [timeOffRequests, reimbursementRequests, notesByJob, photosByJob, checklistByJob] =
        await Promise.all([
          isAdmin
            ? timeOff
                .listForOrg(session.org.id)
                .then((all) => all.filter((r) => pickedTechId === undefined || r.techId === pickedTechId))
            : timeOff.listForTech(techId),
          isAdmin ? reimbursements.listForOrg(session.org.id, pickedTechId) : reimbursements.listForTech(techId),
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

      const pick = (flags: boolean[]): Job[] => assignedJobs.filter((_, i) => flags[i]);
      const lists: Record<string, Job[]> = {
        assigned: assignedJobs,
        open: openJobs,
        notes: pick(notesByJob.map((l) => l.length > 0)),
        photos: pick(photosByJob.map((l) => l.length > 0)),
        checklistOpen: pick(checklistPerJob.map(([open]) => open > 0)),
        checklistSubmitted: pick(checklistPerJob.map(([, submitted]) => submitted > 0)),
      };

      if (!cancelled) {
        setJobLists(lists);
        setTimeOffList(timeOffRequests);
        setReimbList(reimbursementRequests);
        setCounts(
          computeOverviewCounts({
            jobs: assignedJobs,
            timeOff: timeOffRequests,
            reimbursements: reimbursementRequests,
            notesPerJob: notesByJob.map((l) => l.length),
            photosPerJob: photosByJob.map((l) => l.length),
            checklistPerJob,
          }),
        );
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

  const cards: Array<{ key: TileKey; label: string; value: number }> = [
    { key: 'assigned', label: 'Assigned jobs', value: counts.assignedJobs },
    { key: 'open', label: 'Open jobs', value: counts.openJobs },
    { key: 'timeOffPending', label: 'Time off pending', value: counts.timeOffPending },
    { key: 'timeOffApproved', label: 'Time off approved', value: counts.timeOffApproved },
    { key: 'reimbPending', label: 'Reimbursements pending', value: counts.reimbursementsPending },
    { key: 'reimbApproved', label: 'Reimbursements approved', value: counts.reimbursementsApproved },
    { key: 'reimbRejected', label: 'Reimbursements rejected', value: counts.reimbursementsRejected },
    { key: 'notes', label: 'Job notes', value: counts.jobNotes },
    { key: 'photos', label: 'Job photos', value: counts.jobPhotos },
    { key: 'checklistOpen', label: 'Checklist open', value: counts.checklistOpen },
    { key: 'checklistSubmitted', label: 'Checklist submitted', value: counts.checklistSubmitted },
  ];

  if (activeTile !== null) {
    const key = activeTile.key;
    const rows = jobLists[key] ?? [];
    const statusOf: Partial<Record<TileKey, string>> = {
      timeOffPending: 'pending',
      timeOffApproved: 'approved',
      reimbPending: 'pending',
      reimbApproved: 'approved',
      reimbRejected: 'rejected',
    };
    const wanted = statusOf[key];
    const isTimeOff = key === 'timeOffPending' || key === 'timeOffApproved';
    const isReimb = key === 'reimbPending' || key === 'reimbApproved' || key === 'reimbRejected';
    const timeOffRows = isTimeOff ? timeOffList.filter((r) => r.status === wanted) : [];
    const reimbRows = isReimb ? reimbList.filter((r) => r.status === wanted) : [];
    const isEmpty = isTimeOff ? timeOffRows.length === 0 : isReimb ? reimbRows.length === 0 : rows.length === 0;
    return (
      <View style={styles.container}>
        <Pressable onPress={() => setActiveTile(null)} style={styles.row}>
          <Text style={styles.cardLabel}>‹ Back to overview</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>{activeTile.label}</Text>
        {isEmpty ? <Text style={styles.emptyText}>{isTimeOff ? 'No time off.' : isReimb ? 'No reimbursements.' : 'No jobs.'}</Text> : null}
        {rows.map((job) => (
          <Pressable key={job.id} onPress={() => onOpenJob?.(job.id)} style={styles.row}>
            <Text style={styles.cardValue}>
              {job.jobNumber != null ? `#${job.jobNumber}` : 'Job'} {job.customerName ?? ''}
            </Text>
            <Text style={styles.cardLabel}>{job.address ?? ''}</Text>
            <Text style={styles.cardLabel}>{`${jobDate(job)} · ${job.status}`}</Text>
          </Pressable>
        ))}
        {timeOffRows.map((request) => (
          <Pressable key={request.id} onPress={() => onOpenTimeOff?.(request.id)} style={styles.row}>
            <Text style={styles.cardValue}>{`${request.startDate} – ${request.endDate}`}</Text>
            <Text style={styles.cardLabel}>{request.status}</Text>
          </Pressable>
        ))}
        {reimbRows.map((request) => (
          <Pressable key={request.id} onPress={() => onOpenReimbursements?.()} style={styles.row}>
            <Text style={styles.cardValue}>{`$${(request.amountCents / 100).toFixed(2)}`}</Text>
            <Text style={styles.cardLabel}>{request.status}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

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
            key={card.label}
            accessibilityRole="button"
            accessibilityLabel={`${card.label}: ${card.value}`}
            style={styles.card}
            onPress={() => setActiveTile({ key: card.key, label: card.label })}
          >
            <Text style={styles.cardValue}>{card.value}</Text>
            <Text style={styles.cardLabel}>{card.label}</Text>
          </Pressable>
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
