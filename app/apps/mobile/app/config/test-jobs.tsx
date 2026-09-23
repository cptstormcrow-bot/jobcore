/**
 * Test Jobs management screen (Configuration > Test Jobs).
 *
 * Shared home for the "Spawn Test Jobs" / list / delete UX that previously
 * lived inline in `modules/sales-marketing/src/screens/SalesMarketingRoot.tsx`
 * (a separate dispatch is removing that inline panel). Uses
 * `createTestJobsRepository()` directly from
 * `apps/mobile/src/lib/sales-marketing-repos.ts` — no module-ports indirection
 * needed since this screen lives in the host app itself.
 *
 * Job status vocabulary matches `@jobcore/ui`'s `JOB_STATUS_COLORS` (the same
 * `JobStatus` union used everywhere else in the app) — no invented stage names.
 */

import * as React from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { AppChrome, Button, EmptyState, LoadingState, JOB_STATUS_COLORS, colors, spacing, typography, Text } from '@jobcore/ui';
import type { JobStatus } from '@jobcore/core';

import { createTestJobsRepository } from '../../src/lib/sales-marketing-repos';
import { useSession } from '../../src/lib/session';
import { runJobSimulator, type DryRunReport } from '../../src/lib/job-simulator';

interface TestJobRow {
  id: string;
  description: string | null;
  address: string | null;
  status: string;
  createdAt: string;
}

function statusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function statusColor(status: string): string {
  return JOB_STATUS_COLORS[status as JobStatus] ?? colors.textMuted;
}

export default function TestJobsScreen(): React.ReactElement {
  const session = useSession();
  const organizationId = session.status === 'authenticated' ? session.organization.id : null;
  const actorProfile = session.status === 'authenticated' ? session.profile : null;

  const [jobs, setJobs] = React.useState<TestJobRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [spawning, setSpawning] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deletingAll, setDeletingAll] = React.useState(false);
  const [simulating, setSimulating] = React.useState(false);
  const [simulatorReport, setSimulatorReport] = React.useState<DryRunReport | null>(null);

  const repo = React.useMemo(() => createTestJobsRepository(), []);

  const loadJobs = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const rows = await repo.listTestJobs(organizationId);
      setJobs(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test jobs.');
    } finally {
      setLoading(false);
    }
  }, [repo, organizationId]);

  React.useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleSpawn = React.useCallback(async () => {
    if (!organizationId) return;
    setSpawning(true);
    try {
      await repo.spawnTestJobs(organizationId);
      setError(null);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to spawn test jobs.');
    } finally {
      setSpawning(false);
    }
  }, [repo, organizationId, loadJobs]);

  const confirmAsync = React.useCallback(
    (title: string, message: string, confirmLabel: string): Promise<boolean> => {
      if (Platform.OS === 'web') {
        return Promise.resolve(window.confirm(`${title}\n\n${message}`));
      }
      return new Promise((resolve) => {
        Alert.alert(title, message, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
        ]);
      });
    },
    [],
  );

  const handleDelete = React.useCallback(
    async (jobId: string) => {
      const confirmed = await confirmAsync('Delete Test Job', 'Delete this test job?', 'Delete');
      if (!confirmed) return;
      setDeletingId(jobId);
      try {
        await repo.deleteTestJob(jobId);
        setError(null);
        await loadJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete test job.');
      } finally {
        setDeletingId(null);
      }
    },
    [repo, loadJobs, confirmAsync],
  );

  const handleDeleteAll = React.useCallback(async () => {
    if (!organizationId) return;
    const confirmed = await confirmAsync(
      'Delete All Test Jobs',
      'Delete all test jobs? This cannot be undone.',
      'Delete All',
    );
    if (!confirmed) return;
    setDeletingAll(true);
    try {
      await repo.deleteAllTestJobs(organizationId);
      setError(null);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test jobs.');
    } finally {
      setDeletingAll(false);
    }
  }, [repo, organizationId, loadJobs, confirmAsync]);

  const handleRunSimulator = React.useCallback(async () => {
    if (!organizationId || !actorProfile) return;
    const confirmed = await confirmAsync(
      'Run Job Simulator',
      'This creates a REAL job and writes real data across multiple tables (assignment, estimate, payment, payroll). Nothing is auto-deleted. Continue?',
      'Run',
    );
    if (!confirmed) return;
    setSimulating(true);
    try {
      const report = await runJobSimulator(organizationId, actorProfile);
      setSimulatorReport(report);
      setError(null);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run job simulator.');
    } finally {
      setSimulating(false);
    }
  }, [organizationId, actorProfile, loadJobs, confirmAsync]);

  let content: React.ReactElement;
  if (loading) {
    content = <LoadingState label="Loading test jobs…" />;
  } else if (jobs.length === 0) {
    content = <EmptyState title="No Test Jobs" message="Spawn test jobs to see them here." />;
  } else {
    content = (
      <View style={styles.list}>
        {jobs.map((job) => (
          <View key={job.id} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>{job.address ?? job.description ?? job.id}</Text>
              <Text style={[styles.rowStatus, { color: statusColor(job.status) }]}>
                {statusLabel(job.status)}
              </Text>
            </View>
            <Button
              label={deletingId === job.id ? 'Deleting…' : 'Delete'}
              size="sm"
              variant="outline"
              disabled={deletingId === job.id || deletingAll}
              onPress={() => handleDelete(job.id)}
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Configuration' }, { label: 'Test Jobs' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Test Jobs', subtitle: 'Configuration' }}
      />
      <View style={styles.actions}>
        <Button
          label={spawning ? 'Spawning…' : 'Spawn Test Jobs'}
          variant="outline"
          size="sm"
          disabled={spawning}
          onPress={handleSpawn}
        />
        <Button
          label={deletingAll ? 'Deleting all…' : 'Delete All'}
          variant="outline"
          size="sm"
          disabled={deletingAll || jobs.length === 0}
          onPress={handleDeleteAll}
        />
        <Button
          label={simulating ? 'Running…' : 'Run Job Simulator'}
          variant="outline"
          size="sm"
          disabled={simulating || !organizationId || !actorProfile}
          onPress={handleRunSimulator}
        />
      </View>
      {simulatorReport ? (
        <View style={styles.simulatorPanel}>
          <View style={styles.simulatorActions}>
            <Button
              label="Dismiss"
              size="sm"
              variant="primary"
              onPress={() => setSimulatorReport(null)}
            />
            <Button
              label={simulating ? 'Running…' : 'Run Again'}
              size="sm"
              variant="primary"
              disabled={simulating}
              onPress={handleRunSimulator}
            />
          </View>
          <Text style={styles.simulatorWarning}>
            This run created a real job and wrote real data. Nothing was auto-deleted.
          </Text>
          <Text style={styles.simulatorJobId}>
            {simulatorReport.jobId ? `Job ID: ${simulatorReport.jobId}` : 'No job created.'}
          </Text>
          {simulatorReport.stages.map((stage) => (
            <View key={stage.stage} style={styles.simulatorStageRow}>
              <Text
                style={[
                  styles.simulatorStageIndicator,
                  { color: stage.ok ? colors.success : colors.danger },
                ]}
              >
                {stage.ok ? '✓' : '✗'}
              </Text>
              <View style={styles.simulatorStageInfo}>
                <Text style={styles.simulatorStageName}>{statusLabel(stage.stage)}</Text>
                <Text style={styles.simulatorStageDetail}>{stage.detail}</Text>
                {stage.jobStatusAfter ? (
                  <Text style={[styles.rowStatus, { color: statusColor(stage.jobStatusAfter) }]}>
                    {statusLabel(stage.jobStatusAfter)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
  },
  errorText: {
    color: 'red',
    marginHorizontal: 12,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontWeight: typography.weight.semibold,
  },
  rowStatus: {
    marginTop: 2,
    fontSize: 12,
  },
  simulatorPanel: {
    marginHorizontal: 12,
    marginBottom: spacing.sm,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.sm,
  },
  simulatorWarning: {
    color: colors.warning,
    fontWeight: typography.weight.semibold,
  },
  simulatorJobId: {
    color: colors.textLight,
    fontSize: typography.size.h5,
    fontWeight: typography.weight.semibold,
  },
  simulatorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  simulatorStageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  simulatorStageIndicator: {
    fontWeight: typography.weight.bold,
    width: spacing.md,
  },
  simulatorStageInfo: {
    flex: 1,
  },
  simulatorStageName: {
    fontWeight: typography.weight.semibold,
  },
  simulatorStageDetail: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
