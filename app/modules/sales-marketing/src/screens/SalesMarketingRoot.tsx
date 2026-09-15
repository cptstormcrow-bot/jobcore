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
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, AppChrome } from '@jobcore/ui';

import { ReviewLibrary } from './ReviewLibrary';
import { PitchPicker, type PitchAngle } from './PitchPicker';
import { Composer } from './Composer';
import { Reporting } from './Reporting';
import { CallbackTasks } from './CallbackTasks';
import { getModuleSession } from '../lib/module-session';
import { signOut } from '../../../../apps/mobile/src/lib/session';

type SubView = 'reviewLibrary' | 'pitchPicker' | 'composer' | 'reporting' | 'callbackTasks';

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

  const menuItems = React.useMemo(
    () => [
      {
        id: 'reviewLibrary',
        label: 'Review Library',
        isActive: subView === 'reviewLibrary',
        onPress: () => setSubView('reviewLibrary'),
      },
      {
        id: 'pitchPicker',
        label: 'Pitch Picker',
        isActive: subView === 'pitchPicker',
        onPress: () => setSubView('pitchPicker'),
      },
      {
        id: 'composer',
        label: 'Composer',
        isActive: subView === 'composer',
        onPress: () => setSubView('composer'),
      },
      {
        id: 'reporting',
        label: 'Reporting',
        isActive: subView === 'reporting',
        onPress: () => setSubView('reporting'),
      },
      {
        id: 'callbackTasks',
        label: 'Callback tasks',
        isActive: subView === 'callbackTasks',
        onPress: () => setSubView('callbackTasks'),
      },
      {
        id: 'loginsSignInOut',
        label: 'Logins/Sign in/out',
        onPress: () => {
          void signOut();
        },
      },
      {
        id: 'configuration',
        label: 'Configuration',
        onPress: () => {},
        submenu: [
          {
            id: 'configSpawnTestJobs',
            label: 'Spawn Test Jobs',
            onPress: () => router.push('/config/test-jobs'),
          },
          {
            id: 'configSettings',
            label: 'Settings',
            onPress: () => router.push('/config/settings'),
          },
        ],
      },
    ],
    [subView, router],
  );

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
    React.createElement(AppChrome, {
      breadcrumbSegments: [{ label: 'Sales & Marketing' }],
      menuItems,
      optionsItems: [],
    }),
    content,
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});

export default SalesMarketingRoot;
