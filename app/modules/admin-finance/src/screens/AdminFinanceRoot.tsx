/**
 * Route component for the admin-finance module (P3d.3).
 *
 * The host renders this with zero props (`<Screen />`) — ports are injected
 * by the host into the module-scope seam in `../lib/module-ports` (via
 * `setModulePorts`) synchronously in its own render body, BEFORE this
 * component's render body runs (see `apps\mobile\app\m\[moduleId].tsx`'s
 * admin-finance block for why that ordering is guaranteed). This component
 * therefore calls `getModulePorts()` directly, with no null-guard around it,
 * the same pattern `Reporting.tsx` (sales-marketing) uses for its ports —
 * `getModulePorts()` is fail-closed and will throw if that guarantee is ever
 * broken, which is the correct behavior (caught by the per-module Error
 * Boundary) rather than silently rendering with no data.
 *
 * The session is still read through the injected seam in `../lib/module-session`,
 * unchanged from before.
 *
 * This is an internal state-driven sub-view switcher, not a navigator —
 * `route.path` is never read here. Read-only: this screen never writes a
 * job's stage. It has no access to any write path for that field at all.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, Button, EmptyState, LoadingState, ErrorState, colors, spacing, radius } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';

type SubView = 'overview' | 'jobs';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; jobs: Job[] }
  | { kind: 'failed'; message: string };

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Unscheduled';
  return parsed.toLocaleDateString();
}

export function AdminFinanceRoot() {
  const [subView, setSubView] = useState<SubView>('overview');
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });

  const session = useModuleSession();
  const { jobs: jobRepository } = getModulePorts();

  useEffect(() => {
    if (!session) {
      return undefined;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    jobRepository
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', jobs: result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load jobs.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, jobRepository]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Admin & Finance"
          message="Sign in to view this organization's jobs, price sheets, and pay periods."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        <Button label="Overview" variant={subView === 'overview' ? 'primary' : 'outline'} size="sm" onPress={() => setSubView('overview')} style={styles.tabButton} />
        <Button label="Jobs" variant={subView === 'jobs' ? 'primary' : 'outline'} size="sm" onPress={() => setSubView('jobs')} style={styles.tabButton} />
      </View>

      {loadState.kind === 'loading' || loadState.kind === 'idle' ? (
        <LoadingState label="Loading jobs..." />
      ) : loadState.kind === 'failed' ? (
        <ErrorState message={loadState.message} />
      ) : subView === 'overview' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.card}>
            <ListItem title="Jobs" subtitle={`${loadState.jobs.length} on file for this organization`} />
          </Card>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {loadState.jobs.length === 0 ? (
            <EmptyState title="No jobs" message="This organization has no jobs on file." />
          ) : (
            <Card style={styles.card}>
              {loadState.jobs.map((job) => (
                <ListItem key={job.id} title={job.address ?? job.description ?? job.id} subtitle={formatDate(job.scheduledStart)} />
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

export default AdminFinanceRoot;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  tabRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  tabButton: { borderRadius: radius.md },
  content: { padding: spacing.md },
  card: { marginBottom: spacing.md },
});
