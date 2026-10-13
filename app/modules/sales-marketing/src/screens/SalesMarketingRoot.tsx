// JobCore screen #0038 - sales-marketing - Sales & Marketing
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
import { EmptyState, AppChrome, type MenuActionItem } from '@jobcore/ui';
import { moduleSwitcherItems } from '@jobcore/module-sdk';

import { Overview } from './Overview';

import { ReviewLibrary } from './ReviewLibrary';
import { PitchPicker, type PitchAngle } from './PitchPicker';
import { Composer } from './Composer';
import { Reporting } from './Reporting';
import { CallbackTasks } from './CallbackTasks';
import { Payroll } from './Payroll';
import { useModuleSession } from '../lib/module-session';


const SUBVIEW_LABELS: Record<SubView, string> = {
  overview: 'Overview',
  reviewLibrary: 'Review Library',
  pitchPicker: 'Pitch Picker',
  composer: 'Composer',
  reporting: 'Reporting',
  callbackTasks: 'Callback tasks',
  payroll: 'Payroll',
};

export function SalesMarketingRoot(): React.ReactElement {
  const router = useRouter();
  const session = useModuleSession();
  const [subView, setSubView] = React.useState<SubView>('overview');
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
        id: 'overview',
        label: 'Overview',
        isActive: subView === 'overview',
        onPress: () => setSubView('overview'),
      },
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
        id: 'payroll',
        label: 'Payroll',
        isActive: subView === 'payroll',
        onPress: () => setSubView('payroll'),
      },
    ],
    [subView],
  );

  const logoMenuItems = React.useMemo<MenuActionItem[]>(
    () => [
      {
        id: 'logo-/m/sales-marketing',
        label: 'Sales & Marketing',
        isActive: true,
        onPress: () => router.push('/m/sales-marketing' as never),
      },
      ...moduleSwitcherItems('sales-marketing', session?.role).map((row) => ({
        id: `logo-${row.route}`,
        label: row.label,
        isActive: false,
        onPress: () => router.push(row.route as never),
      })),
    ],
    [router, session?.role],
  );

  const gearItems = React.useMemo(
    () => [
      { id: 'gearLogin', label: 'Sign Out', onPress: () => router.push('/account') },
      { id: 'gearSettings', label: 'Settings', onPress: () => router.push('/config/settings') },
      { id: 'gearProfile', label: 'Profile', onPress: () => router.push('/profile') },
    ],
    [router],
  );

  let content: React.ReactElement;
  switch (subView) {
    case 'pitchPicker':
      content = React.createElement(PitchPicker, { onNavigateToComposer: handleNavigateToComposer });
      break;
    case 'composer': {
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
    case 'payroll':
      content = React.createElement(Payroll, null);
      break;
    case 'reviewLibrary':
      content = React.createElement(ReviewLibrary, null);
      break;
    case 'overview':
    default:
      content = React.createElement(Overview, { onOpenReviewLibrary: () => setSubView('reviewLibrary') });
      break;
  }

  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(AppChrome, {
      breadcrumbSegments: [{ label: 'Sales & Marketing' }],
      menuItems,
      logoMenuItems,
      showBack: false,
      compactMenu: true,
      gearItems,
      gearTitle: 'Configurations',
      optionsItems: [],
      titleBar: { title: 'Sales & Marketing', subtitle: SUBVIEW_LABELS[subView] },
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
