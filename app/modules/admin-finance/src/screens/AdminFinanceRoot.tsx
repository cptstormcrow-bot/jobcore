/**
 * Route component for the admin-finance module (P3d.3).
 *
 * The host renders this with zero props (`<Screen />`) — every prop here is
 * optional and the component must render a truthful empty view when nothing
 * is injected. Ports are read through the injected seam in
 * `../lib/module-ports` (`getModulePorts`); the session is read through the
 * injected seam in `../lib/module-session`.
 *
 * This is an internal state-driven sub-view switcher, not a navigator —
 * `route.path` is never read here. Read-only: this screen never writes a
 * job's stage. It has no access to any write path for that field at all.
 *
 * `leads`/`priceSheets` sub-views render `LeadInboxScreen`/
 * `PriceSheetListScreen` (both props-driven, not ports-driven — this screen
 * passes the repository down) plus an owned "+ New" action that switches to
 * `leadCreate`/`priceSheetCreate`, rendering `LeadCreateScreen`/
 * `PriceSheetCreateScreen` (both self-inject via `getModulePorts()`) with
 * `onCreated`/`onCancel` returning to the list. Neither list screen embeds
 * its own create affordance, so this screen owns it (P4 Batch 5 plan,
 * "+ New" action pattern — avoids growing an already-crowded tab row).
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, Button, EmptyState, LoadingState, ErrorState, colors, spacing, radius } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import LeadInboxScreen from './LeadInboxScreen';
import PriceSheetListScreen from './PriceSheetListScreen';
import LeadCreateScreen from './LeadCreateScreen';
import PriceSheetCreateScreen from './PriceSheetCreateScreen';

type SubView = 'overview' | 'jobs' | 'leads' | 'priceSheets' | 'leadCreate' | 'priceSheetCreate';

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

  const session = getModuleSession();

  useEffect(() => {
    if (!session) {
      return;
    }
    const { jobs: jobRepository } = getModulePorts();
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
  }, [session]);

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

  const ports = getModulePorts();

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        <Button
          label="Overview"
          variant={subView === 'overview' ? 'primary' : 'outline'}
          size="sm"
          onPress={() => setSubView('overview')}
          style={styles.tabButton}
        />
        <Button
          label="Jobs"
          variant={subView === 'jobs' ? 'primary' : 'outline'}
          size="sm"
          onPress={() => setSubView('jobs')}
          style={styles.tabButton}
        />
        <Button
          label="Leads"
          variant={subView === 'leads' ? 'primary' : 'outline'}
          size="sm"
          onPress={() => setSubView('leads')}
          style={styles.tabButton}
        />
        <Button
          label="Price Sheets"
          variant={subView === 'priceSheets' ? 'primary' : 'outline'}
          size="sm"
          onPress={() => setSubView('priceSheets')}
          style={styles.tabButton}
        />
      </View>

      {subView === 'leadCreate' ? (
        <LeadCreateScreen onCreated={() => setSubView('leads')} onCancel={() => setSubView('leads')} />
      ) : subView === 'priceSheetCreate' ? (
        <PriceSheetCreateScreen
          onCreated={() => setSubView('priceSheets')}
          onCancel={() => setSubView('priceSheets')}
        />
      ) : subView === 'leads' ? (
        <View style={styles.subScreen}>
          <View style={styles.newActionRow}>
            <Button label="+ New" variant="primary" size="sm" onPress={() => setSubView('leadCreate')} />
          </View>
          <LeadInboxScreen leads={ports.leads} />
        </View>
      ) : subView === 'priceSheets' ? (
        <View style={styles.subScreen}>
          <View style={styles.newActionRow}>
            <Button label="+ New" variant="primary" size="sm" onPress={() => setSubView('priceSheetCreate')} />
          </View>
          <PriceSheetListScreen priceSheets={ports.priceSheets} />
        </View>
      ) : loadState.kind === 'loading' || loadState.kind === 'idle' ? (
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
                <ListItem
                  key={job.id}
                  title={job.address ?? job.description ?? job.id}
                  subtitle={formatDate(job.scheduledStart)}
                />
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
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  tabRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tabButton: {
    borderRadius: radius.md,
  },
  subScreen: {
    flex: 1,
  },
  newActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
});
