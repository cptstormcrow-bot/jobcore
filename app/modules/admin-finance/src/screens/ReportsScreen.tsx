/**
 * Reports screen — read-only reporting summaries (P3l.4).
 *
 * Wires together the three P3-l pure reporting helpers into one screen:
 * `../reporting/group-by.ts` (`byStatus`; `bySource`/`byAttachTiming` moved to Sales & Marketing Reporting),
 * `../reporting/slot-hit-rate.ts` (`slotHitRate`), and
 * `../reporting/revenue.ts` (`commissionTotals`). All three are pure
 * functions with no I/O — this screen owns no fetching, so it takes plain
 * `Job[]`/`CommissionAmountSource[]` props rather than a repo, mirroring
 * the "prefer the simpler plain-props shape" guidance for this slice; no
 * `JobsRepo`/`CommissionsRepo` exists yet under `../data/` (checked:
 * `payout-batch-repo.ts`, `price-sheet-repo.ts`, `reimbursement-repo.ts`
 * only), so inventing one here would be out of scope.
 *
 * Every reporting helper in this module group follows an honest-unknown
 * discipline: a null/unparseable source field is counted separately as
 * `'unknown'` rather than folded into a hit/miss/known bucket or silently
 * dropped. This screen preserves that discipline in its rendering — the
 * "unknown" counts from `bySource`/`byAttachTiming`/`slotHitRate`/
 * `commissionTotals` are always shown as their own labeled line, never
 * hidden or merged into a total, so nobody reading this screen mistakes an
 * unclassified record for a known-good one.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, Button, EmptyState, ScreenTitle, colors, spacing, typography } from '@jobcore/ui';
import type { Job, JobStatus } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { byStatus } from '../reporting/group-by';
import { slotHitRate, classifyWindow } from '../reporting/slot-hit-rate';
import { commissionTotals, type CommissionAmountSource } from '../reporting/revenue';
import { getModuleSession } from '../lib/module-session';

export interface ReportsScreenProps {
  jobs?: Job[];
  commissions?: CommissionAmountSource[];
  /** "Show Test Jobs" toggle state — mirrors `AssignmentBoardScreen.tsx`'s `showTestJobs` prop. Filtering is applied only at job-row render time, never at aggregate/count computation. */
  showTestJobs?: boolean;
  /** Bubbles a job selection up to the parent (level 2 — `ReportsJobDetailScreen.tsx` is wired by AdminFinanceRoot.tsx, not built here). */
  onSelectJob?: (job: Job) => void;
  onBack?: () => void;
}

/** Which of the 5 sections, if any, is currently drilled into, plus the selected group/bucket key within it. */
type DrillState =
  | { section: 'status'; key: JobStatus }
  | { section: 'slotHitRate'; key: 'hit' | 'miss' | 'unknown' }
  | { section: 'commissionTotals'; key: 'known' | 'unknown' }
  | null;

/** Local, honest formatter for cents — this screen has no shared money formatter to reuse. */
function formatAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** Renders a drilled-into job list for a group/bucket, filtering test jobs at row-render time only. */
function JobListDrillDown(props: {
  jobs: Job[];
  showTestJobs: boolean;
  onSelectJob?: (job: Job) => void;
  onBack: () => void;
}) {
  const { jobs, showTestJobs, onSelectJob, onBack } = props;
  const visibleJobs = jobs.filter((job) => isBetaVisible(job, showTestJobs));

  return (
    <Card style={styles.card}>
      <Button label="< Back" variant="primary" size="sm" onPress={onBack} style={styles.backButton} />
      {visibleJobs.length === 0 ? (
        <EmptyState title="No jobs" message="No jobs match this group." />
      ) : (
        visibleJobs.map((job) => (
          <ListItem
            key={job.id}
            title={job.jobNumber != null ? `Job #${job.jobNumber}` : job.id}
            subtitle={[job.address, job.status].filter(Boolean).join(' · ')}
            onPress={onSelectJob ? () => onSelectJob(job) : undefined}
          />
        ))
      )}
    </Card>
  );
}

export function ReportsScreen(props: ReportsScreenProps = {}) {
  const { jobs, commissions, showTestJobs = false, onSelectJob, onBack } = props;
  const [drill, setDrill] = useState<DrillState>(null);

  const session = getModuleSession();

  const banner = (
    <Text style={styles.banner}>Reports are read-only summaries</Text>
  );

  if (!session) {
    return (
      <View style={styles.screen}>
        {banner}
        <EmptyState
          title="Reports"
          message="Sign in to view this organization's reports."
        />
      </View>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <View style={styles.screen}>
        {banner}
        <EmptyState title="Reports" message="No jobs are available to report on yet." />
      </View>
    );
  }

  const statusGroups = byStatus(jobs);
  const hitRate = slotHitRate(jobs);
  const commissionRecords = commissions ?? [];
  const totals = commissionTotals(commissionRecords);

  // Slot Hit Rate has no pre-existing Record<string, Job[]> grouping — bucket client-side by classifyWindow.
  const slotHitRateGroups: Record<'hit' | 'miss' | 'unknown', Job[]> = { hit: [], miss: [], unknown: [] };
  for (const job of jobs) {
    slotHitRateGroups[classifyWindow(job)].push(job);
  }

  // Commission Totals has no job list at all — map CommissionAmountSource.jobId back onto the loaded Job[].
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const knownCommissionJobIds = new Set(
    commissionRecords.filter((c) => c.amount !== null && c.amount !== undefined).map((c) => c.jobId),
  );
  const unknownCommissionJobIds = new Set(
    commissionRecords.filter((c) => c.amount === null || c.amount === undefined).map((c) => c.jobId),
  );
  const commissionKnownJobs = [...knownCommissionJobIds]
    .map((id) => jobsById.get(id))
    .filter((job): job is Job => job !== undefined);
  const commissionUnknownJobs = [...unknownCommissionJobIds]
    .map((id) => jobsById.get(id))
    .filter((job): job is Job => job !== undefined);

  const backProps = { showTestJobs, onSelectJob, onBack: () => setDrill(null) };

  return (
    <View style={styles.screen}>
      {banner}
      <ScrollView contentContainerStyle={styles.content}>
        {onBack ? (
          <Button label="< Back" variant="primary" size="sm" onPress={onBack} style={styles.backButton} />
        ) : null}
        <ScreenTitle title="Reports" />
        <Text style={styles.groupHeading}>By Status</Text>
        {drill?.section === 'status' ? (
          <JobListDrillDown jobs={statusGroups[drill.key] ?? []} {...backProps} />
        ) : (
          <Card style={styles.card}>
            {Object.entries(statusGroups).map(([status, groupJobs]) => (
              <ListItem
                key={status}
                title={status}
                subtitle={`${groupJobs.length} job(s)`}
                onPress={() => setDrill({ section: 'status', key: status as JobStatus })}
              />
            ))}
          </Card>
        )}

        <Text style={styles.groupHeading}>Slot Hit Rate</Text>
        {drill?.section === 'slotHitRate' ? (
          <JobListDrillDown jobs={slotHitRateGroups[drill.key] ?? []} {...backProps} />
        ) : (
          <Card style={styles.card}>
            <ListItem title="Hit" subtitle={`${hitRate.hit}`} onPress={() => setDrill({ section: 'slotHitRate', key: 'hit' })} />
            <ListItem title="Miss" subtitle={`${hitRate.miss}`} onPress={() => setDrill({ section: 'slotHitRate', key: 'miss' })} />
            <ListItem
              title="Unknown"
              subtitle={`${hitRate.unknown}`}
              onPress={() => setDrill({ section: 'slotHitRate', key: 'unknown' })}
            />
            <ListItem title="Total" subtitle={`${hitRate.total}`} />
            <ListItem title="Hit Rate" subtitle={formatPercent(hitRate.hitRate)} />
          </Card>
        )}

        <Text style={styles.groupHeading}>Commission Totals</Text>
        {drill?.section === 'commissionTotals' ? (
          <JobListDrillDown
            jobs={drill.key === 'known' ? commissionKnownJobs : commissionUnknownJobs}
            {...backProps}
          />
        ) : (
          <Card style={styles.card}>
            <ListItem title="Total Commission" subtitle={formatAmount(totals.totalCommission)} />
            <ListItem
              title="Known"
              subtitle={`${totals.knownCount}`}
              onPress={() => setDrill({ section: 'commissionTotals', key: 'known' })}
            />
            <ListItem
              title="Unknown"
              subtitle={`${totals.unknownCount}`}
              onPress={() => setDrill({ section: 'commissionTotals', key: 'unknown' })}
            />
            <ListItem title="Job Count" subtitle={`${totals.jobCount}`} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default ReportsScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  banner: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    backgroundColor: colors.border,
    padding: spacing.xs,
    textAlign: 'center',
  },
  content: {
    padding: spacing.md,
  },
  groupHeading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  backButton: {
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
});
