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
import { View, Text, StyleSheet, Alert } from 'react-native';
import { AppChrome, Button, EmptyState, LoadingState, JOB_STATUS_COLORS } from '@jobcore/ui';
import type { JobStatus } from '@jobcore/core';

import { createTestJobsRepository } from '../../src/lib/sales-marketing-repos';
import { useSession } from '../../src/lib/session';

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
  return JOB_STATUS_COLORS[status as JobStatus] ?? '#999999';
}

export default function TestJobsScreen(): React.ReactElement {
  const session = useSession();
  const organizationId = session.status === 'authenticated' ? session.organization.id : null;

  const [jobs, setJobs] = React.useState<TestJobRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [spawning, setSpawning] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deletingAll, setDeletingAll] = React.useState(false);

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

  const handleDelete = React.useCallback(
    (jobId: string) => {
      Alert.alert('Delete Test Job', 'Delete this test job?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
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
        },
      ]);
    },
    [repo, loadJobs],
  );

  const handleDeleteAll = React.useCallback(() => {
    if (!organizationId) return;
    Alert.alert('Delete All Test Jobs', 'Delete all test jobs? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
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
        },
      },
    ]);
  }, [repo, organizationId, loadJobs]);

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
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: 'red',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  list: {
    gap: 8,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontWeight: '600',
  },
  rowStatus: {
    marginTop: 2,
    fontSize: 12,
  },
});
