/**
 * sales-marketing module top-level nav container.
 *
 * Mirrors `field-tech/src/index.ts`'s `FieldTechRoot` state-driven tab
 * pattern (never a navigator — the host's single `path` segment is the
 * only route entry this module owns). Wires the module's five screens
 * (Review Library, Pitch Picker, Composer, Reporting, Callback Tasks) as
 * sibling tabs.
 *
 * `./ReviewLibrary`, `./PitchPicker`, `./Composer`, `./Reporting`, and
 * `./CallbackTasks` are all implemented and wired here as sibling tabs —
 * same-pattern as field-tech importing its own screens directly in
 * `index.ts`.
 */

import * as React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState, Breadcrumb, TabBar, ScreenTitle } from '@jobcore/ui';

import { ReviewLibrary } from './ReviewLibrary';
import { PitchPicker, type PitchAngle } from './PitchPicker';
import { Composer } from './Composer';
import { Reporting } from './Reporting';
import { CallbackTasks } from './CallbackTasks';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import type { TestJobRow } from '../data/ports';

type SubView = 'reviewLibrary' | 'pitchPicker' | 'composer' | 'reporting' | 'callbackTasks';

const TABS: Array<{ key: SubView; label: string }> = [
  { key: 'reviewLibrary', label: 'Review Library' },
  { key: 'pitchPicker', label: 'Pitch Picker' },
  { key: 'composer', label: 'Composer' },
  { key: 'reporting', label: 'Reporting' },
  { key: 'callbackTasks', label: 'Callback Tasks' },
];

export function SalesMarketingRoot(): React.ReactElement {
  const router = useRouter();
  const [subView, setSubView] = React.useState<SubView>('reviewLibrary');
  const [pitchAngle, setPitchAngle] = React.useState<PitchAngle | null>(null);
  // No service/service-area picker exists yet anywhere in this module —
  // these stay null until one lands; Composer already treats both as
  // nullable (`serviceId: string | null` / `serviceAreaId: string | null`).
  const [serviceId] = React.useState<string | null>(null);
  const [serviceAreaId] = React.useState<string | null>(null);

  const handleNavigateToComposer = React.useCallback((angle: PitchAngle) => {
    setPitchAngle(angle);
    setSubView('composer');
  }, []);

  // Workstream K: "Spawn Test Jobs". No dedicated lead-intake entry point
  // exists in this module (lead intake actually lives in admin-finance's
  // LeadInboxScreen) — this button rides the module's top-level tab row
  // instead, as the closest analog to "next to the existing entry point".
  // spawnTestJobs is reset-then-insert/idempotent per the TestJobsRepository
  // contract (data/ports.ts), implemented in
  // apps/mobile/src/lib/sales-marketing-repos.ts. Spawned jobs are tagged
  // is_beta = true so they can be listed and deleted independently of real
  // jobs, which are never deletable — see the test-jobs panel rendered
  // below the tab row.
  const [spawningTestJobs, setSpawningTestJobs] = React.useState(false);
  const [testJobs, setTestJobs] = React.useState<TestJobRow[]>([]);
  const [testJobsError, setTestJobsError] = React.useState<string | null>(null);
  const [deletingTestJobId, setDeletingTestJobId] = React.useState<string | null>(null);
  const [deletingAllTestJobs, setDeletingAllTestJobs] = React.useState(false);

  const loadTestJobs = React.useCallback(async () => {
    const session = getModuleSession();
    if (session === null) {
      return;
    }
    try {
      const rows = await getModulePorts().testJobs.listTestJobs(session.org.id);
      setTestJobs(rows);
      setTestJobsError(null);
    } catch (err) {
      setTestJobsError(err instanceof Error ? err.message : 'Failed to load test jobs.');
    }
  }, []);

  React.useEffect(() => {
    void loadTestJobs();
  }, [loadTestJobs]);

  const handleSpawnTestJobs = React.useCallback(async () => {
    const session = getModuleSession();
    if (session === null) {
      return;
    }
    setSpawningTestJobs(true);
    try {
      await getModulePorts().testJobs.spawnTestJobs(session.org.id);
      setTestJobsError(null);
      await loadTestJobs();
    } catch (err) {
      setTestJobsError(err instanceof Error ? err.message : 'Failed to spawn test jobs.');
    } finally {
      setSpawningTestJobs(false);
    }
  }, [loadTestJobs]);

  const handleDeleteTestJob = React.useCallback(
    async (jobId: string) => {
      setDeletingTestJobId(jobId);
      try {
        await getModulePorts().testJobs.deleteTestJob(jobId);
        setTestJobsError(null);
        await loadTestJobs();
      } catch (err) {
        setTestJobsError(err instanceof Error ? err.message : 'Failed to delete test job.');
      } finally {
        setDeletingTestJobId(null);
      }
    },
    [loadTestJobs],
  );

  const handleDeleteAllTestJobs = React.useCallback(async () => {
    const session = getModuleSession();
    if (session === null) {
      return;
    }
    setDeletingAllTestJobs(true);
    try {
      await getModulePorts().testJobs.deleteAllTestJobs(session.org.id);
      setTestJobsError(null);
      await loadTestJobs();
    } catch (err) {
      setTestJobsError(err instanceof Error ? err.message : 'Failed to delete test jobs.');
    } finally {
      setDeletingAllTestJobs(false);
    }
  }, [loadTestJobs]);

  let content: React.ReactElement;
  switch (subView) {
    case 'pitchPicker':
      content = React.createElement(PitchPicker, { onNavigateToComposer: handleNavigateToComposer });
      break;
    case 'composer': {
      const session = getModuleSession();
      content =
        session !== null && pitchAngle !== null
          ? React.createElement(Composer, {
              organizationId: session.org.id,
              pitchAngle,
              serviceId,
              serviceAreaId,
              onDone: () => setSubView('pitchPicker'),
            })
          : React.createElement(EmptyState, {
              title: 'Compose Post',
              message: 'Select a pitch angle to start composing a post.',
            });
      break;
    }
    case 'reporting':
      content = React.createElement(Reporting, null);
      break;
    case 'callbackTasks':
      content = React.createElement(CallbackTasks, null);
      break;
    case 'reviewLibrary':
    default:
      content = React.createElement(ReviewLibrary, null);
      break;
  }

  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(Breadcrumb, { segments: [{ label: 'Sales & Marketing' }] }),
    React.createElement(
      View,
      { style: styles.header },
      <TabBar items={TABS} activeKey={subView} onSelect={setSubView} style={styles.tabBar} />,
      React.createElement(Button, {
        key: 'spawnTestJobs',
        label: spawningTestJobs ? 'Spawning…' : 'Spawn Test Jobs',
        variant: 'outline',
        size: 'sm',
        disabled: spawningTestJobs,
        onPress: handleSpawnTestJobs,
      }),
    ),
    testJobsError || testJobs.length > 0
      ? React.createElement(
          View,
          { key: 'testJobsPanel', style: styles.testJobsPanel },
          React.createElement(ScreenTitle, { key: 'testJobsPanelTitle', title: 'Test Jobs' }),
          testJobsError ? React.createElement(Text, { style: styles.errorText }, testJobsError) : null,
          testJobs.length > 0
            ? React.createElement(
                View,
                { style: styles.testJobsList },
                ...testJobs.map((job) =>
                  React.createElement(
                    Pressable,
                    { key: job.id, style: styles.testJobRow, onPress: () => router.push(`/job/${job.id}`) },
                    React.createElement(
                      Text,
                      { style: styles.testJobLabel },
                      job.address ?? job.description ?? job.id,
                    ),
                    React.createElement(Button, {
                      label: deletingTestJobId === job.id ? 'Deleting…' : 'Delete',
                      size: 'sm',
                      variant: 'outline',
                      disabled: deletingTestJobId === job.id || deletingAllTestJobs,
                      onPress: () => handleDeleteTestJob(job.id),
                    }),
                  ),
                ),
                React.createElement(Button, {
                  key: 'deleteAllTestJobs',
                  label: deletingAllTestJobs ? 'Deleting all…' : 'Delete All',
                  size: 'sm',
                  variant: 'outline',
                  disabled: deletingAllTestJobs || deletingTestJobId !== null,
                  onPress: handleDeleteAllTestJobs,
                }),
              )
            : null,
        )
      : null,
    content,
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBar: {
    flex: 1,
  },
  testJobsPanel: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  testJobsList: {
    gap: 8,
  },
  testJobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  testJobLabel: {
    flex: 1,
  },
  errorText: {
    color: 'red',
    marginTop: 4,
    marginBottom: 4,
  },
});

export default SalesMarketingRoot;
