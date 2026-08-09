/**
 * Reports screen — read-only reporting summaries (P3l.4).
 *
 * Wires together the three P3-l pure reporting helpers into one screen:
 * `../reporting/group-by.ts` (`byStatus`, `bySource`, `byAttachTiming`),
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

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, EmptyState, colors, spacing, typography } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import { byStatus, bySource, byAttachTiming } from '../reporting/group-by';
import { slotHitRate } from '../reporting/slot-hit-rate';
import { commissionTotals, type CommissionAmountSource } from '../reporting/revenue';
import { getModuleSession } from '../lib/module-session';

export interface ReportsScreenProps {
  jobs?: Job[];
  commissions?: CommissionAmountSource[];
}

/** Local, honest formatter for cents — this screen has no shared money formatter to reuse. */
function formatAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function ReportsScreen(props: ReportsScreenProps = {}) {
  const { jobs, commissions } = props;

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
  const sourceGroups = bySource(jobs);
  const attachTimingGroups = byAttachTiming(jobs);
  const hitRate = slotHitRate(jobs);
  const totals = commissionTotals(commissions ?? []);

  return (
    <View style={styles.screen}>
      {banner}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.groupHeading}>By Status</Text>
        <Card style={styles.card}>
          {Object.entries(statusGroups).map(([status, groupJobs]) => (
            <ListItem key={status} title={status} subtitle={`${groupJobs.length} job(s)`} />
          ))}
        </Card>

        <Text style={styles.groupHeading}>By Source</Text>
        <Card style={styles.card}>
          {Object.entries(sourceGroups).map(([source, groupJobs]) => (
            <ListItem key={source} title={source} subtitle={`${groupJobs.length} job(s)`} />
          ))}
        </Card>

        <Text style={styles.groupHeading}>By Attach Timing</Text>
        <Card style={styles.card}>
          {Object.entries(attachTimingGroups).map(([timing, groupJobs]) => (
            <ListItem key={timing} title={timing} subtitle={`${groupJobs.length} job(s)`} />
          ))}
        </Card>

        <Text style={styles.groupHeading}>Slot Hit Rate</Text>
        <Card style={styles.card}>
          <ListItem title="Hit" subtitle={`${hitRate.hit}`} />
          <ListItem title="Miss" subtitle={`${hitRate.miss}`} />
          <ListItem title="Unknown" subtitle={`${hitRate.unknown}`} />
          <ListItem title="Total" subtitle={`${hitRate.total}`} />
          <ListItem title="Hit Rate" subtitle={formatPercent(hitRate.hitRate)} />
        </Card>

        <Text style={styles.groupHeading}>Commission Totals</Text>
        <Card style={styles.card}>
          <ListItem title="Total Commission" subtitle={formatAmount(totals.totalCommission)} />
          <ListItem title="Known" subtitle={`${totals.knownCount}`} />
          <ListItem title="Unknown" subtitle={`${totals.unknownCount}`} />
          <ListItem title="Job Count" subtitle={`${totals.jobCount}`} />
        </Card>
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
});
