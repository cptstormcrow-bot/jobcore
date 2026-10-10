// JobCore screen #0064 - af-ReportsJobDetailScreen - Reports Job Detail Screen
/**
 * Reports job-detail screen — READ-ONLY.
 *
 * Renders status, address, schedule, assigned technician, source, attach
 * timing, requested window, commission total, and created/completed
 * timestamps for a single job, using this module's Card/ListItem layout
 * conventions (`EmployeeJobDetailScreen.tsx`). No job-action buttons and no
 * mutation calls.
 *
 * Commission is labeled "Commission", never "Revenue" — this module's
 * schema has no revenue figure (see `reporting/revenue.ts`'s doc comment);
 * the value shown here is a plain sum of `commissions` rows for this job,
 * never a recomputed rate.
 *
 * Below the summary card, an "Activity" section loads this job's audit log
 * entries on mount via `getModulePorts().auditLog.listForOrganization`,
 * tracking a `LoadState` idle/loading/loaded/failed union and rendering
 * newest-first, mirroring `AuditLogScreen.tsx`'s row shape exactly.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, EmptyState, ErrorState, ListItem, LoadingState, ScreenTitle, colors, spacing, Text } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import type { AuditLogEntry } from '../data/ports';
import type { CommissionAmountSource } from '../reporting/revenue';
import { commissionTotals } from '../reporting/revenue';
import { getModulePorts } from '../lib/module-ports';

export interface ReportsJobDetailScreenProps {
  job: Job;
  commissions: CommissionAmountSource[];
  organizationId: string;
  techName?: string;
  onBack: () => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: AuditLogEntry[] }
  | { kind: 'failed'; message: string };

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Not scheduled';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not scheduled';
  return parsed.toLocaleString();
}

export function ReportsJobDetailScreen(props: ReportsJobDetailScreenProps) {
  const { job, commissions, organizationId, techName, onBack } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    getModulePorts()
      .auditLog.listForOrganization(organizationId, { entity: 'job', entityId: job.id })
      .then((result) => {
        if (!cancelled) setLoadState({ kind: 'loaded', entries: result });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load the activity log.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, job.id]);

  const { totalCommission } = commissionTotals(commissions.filter((c) => c.jobId === job.id));

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Job Details" subtitle={job.address ?? undefined} />
      <ScrollView contentContainerStyle={styles.content}>
        <Button label="Back" variant="outline" size="sm" onPress={onBack} style={styles.action} />

        <Card style={styles.card}>
          <ListItem title="Status" subtitle={job.status} />
          <ListItem title="Address" subtitle={job.address ?? 'No address'} />
          <ListItem title="Scheduled" subtitle={formatDate(job.scheduledStart)} />
          <ListItem title="Assigned Technician" subtitle={techName ?? job.assignedTechId ?? 'Unassigned'} />
          <ListItem title="Source" subtitle={job.source ?? 'Unknown'} />
          <ListItem title="Attach Timing" subtitle={job.attachTiming ?? 'Unknown'} />
          <ListItem title="Requested Window" subtitle={job.requestedWindow ?? 'None'} />
          <ListItem title="Commission" subtitle={String(totalCommission)} />
          <ListItem title="Created" subtitle={formatDate(job.createdAt)} />
          <ListItem title="Completed" subtitle={formatDate(job.completedAt)} />
        </Card>

        <ScreenTitle title="Activity" />
        {loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading activity..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : loadState.entries.length === 0 ? (
          <EmptyState title="No activity" message="Nothing has been recorded for this job yet." />
        ) : (
          <Card style={styles.card}>
            {[...loadState.entries]
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
              .map((entry) => (
                <View key={entry.id} style={styles.row}>
                  <Text style={styles.actionText}>{entry.action}</Text>
                  <Text style={styles.detail}>{entry.actorId ?? 'system'}</Text>
                  <Text style={styles.timestamp}>{entry.createdAt}</Text>
                </View>
              ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

export default ReportsJobDetailScreen;

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
  action: {
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionText: {
    fontWeight: '600',
  },
  detail: {
    color: colors.textLight,
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
