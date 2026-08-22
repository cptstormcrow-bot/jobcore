/**
 * sales-marketing module top-level nav container.
 *
 * Mirrors `field-tech/src/index.ts`'s `FieldTechRoot` state-driven tab
 * pattern (never a navigator — the host's single `path` segment is the
 * only route entry this module owns). Wires the module's four screens
 * (Review Library, Pitch Picker, Composer, Reporting) as sibling tabs.
 *
 * `./ReviewLibrary`, `./PitchPicker`, `./Composer`, `./Reporting` do not
 * exist yet as of this pass — this file wires the import contract ahead
 * of their landing, same-pattern as field-tech importing its own screens
 * directly in `index.ts`.
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from '@jobcore/ui';

import { ReviewLibrary } from './ReviewLibrary';
import { PitchPicker, type PitchAngle } from './PitchPicker';
import { Composer } from './Composer';
import { Reporting } from './Reporting';
import { CallbackTasks } from './CallbackTasks';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

type SubView = 'reviewLibrary' | 'pitchPicker' | 'composer' | 'reporting' | 'callbackTasks';

const TABS: Array<{ key: SubView; label: string }> = [
  { key: 'reviewLibrary', label: 'Review Library' },
  { key: 'pitchPicker', label: 'Pitch Picker' },
  { key: 'composer', label: 'Composer' },
  { key: 'reporting', label: 'Reporting' },
  { key: 'callbackTasks', label: 'Callback Tasks' },
];

export function SalesMarketingRoot(): React.ReactElement {
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
  // contract (data/ports.ts); no host-side port implementation is wired yet.
  const [spawningTestJobs, setSpawningTestJobs] = React.useState(false);
  const handleSpawnTestJobs = React.useCallback(async () => {
    const session = getModuleSession();
    if (session === null) {
      return;
    }
    setSpawningTestJobs(true);
    try {
      await getModulePorts().testJobs.spawnTestJobs(session.org.id);
    } finally {
      setSpawningTestJobs(false);
    }
  }, []);

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
          : React.createElement(
              View,
              null,
              // No session or no pitch angle selected yet — Composer
              // requires both required props to be real values, so fall
              // back to Pitch Picker's own tab rather than mounting
              // Composer with placeholder/invalid props.
            );
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
    React.createElement(
      View,
      { style: styles.tabRow },
      ...TABS.map((tab) =>
        React.createElement(Button, {
          key: tab.key,
          label: tab.label,
          variant: subView === tab.key ? 'primary' : 'outline',
          size: 'sm',
          onPress: () => setSubView(tab.key),
          style: styles.tabButton,
        }),
      ),
      React.createElement(Button, {
        key: 'spawnTestJobs',
        label: spawningTestJobs ? 'Spawning…' : 'Spawn Test Jobs',
        variant: 'outline',
        size: 'sm',
        disabled: spawningTestJobs,
        onPress: handleSpawnTestJobs,
        style: styles.tabButton,
      }),
    ),
    content,
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  tabButton: {
    borderRadius: 6,
  },
});

export default SalesMarketingRoot;
