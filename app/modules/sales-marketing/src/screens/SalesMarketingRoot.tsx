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
import { View, StyleSheet, BackHandler, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { EmptyState, AppChrome, useScreenNumber, type MenuActionItem } from '@jobcore/ui';
import { moduleSwitcherItems } from '@jobcore/module-sdk';

import { Overview } from './Overview';

import { ReviewLibrary } from './ReviewLibrary';
import { PitchPicker, type PitchAngle } from './PitchPicker';
import { Composer } from './Composer';
import { Reporting } from './Reporting';
import { CallbackTasks } from './CallbackTasks';
import { Payroll } from './Payroll';
import { useModuleSession } from '../lib/module-session';

type SubView = 'overview' | 'reviewLibrary' | 'pitchPicker' | 'composer' | 'reporting' | 'callbackTasks' | 'payroll';

type HelpScreenKey = NonNullable<React.ComponentProps<typeof AppChrome>['helpContext']>['screenKey'];

const HELP_SCREEN_KEYS: Record<SubView, HelpScreenKey> = {
  overview: 'sm-overview',
  pitchPicker: 'sm-pitch',
  composer: 'sm-composer',
  reporting: 'sm-reporting',
  callbackTasks: 'sm-callbacks',
  payroll: 'sm-reporting',
  reviewLibrary: 'sm-reviews',
};

const SUBVIEW_LABELS:Record<SubView, string> = {
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
  // The tab lives in the route too, so coming back from another screen lands on the same tab.
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [subView, setSubView] = React.useState<SubView>(
    view && view in HELP_SCREEN_KEYS ? (view as SubView) : 'overview',
  );
  // Android back returns to the tab you came from; every tab change is recorded here.
  const viewHistory = React.useRef<SubView[]>([]);
  const prevView = React.useRef<SubView>(subView);
  const poppingBack = React.useRef(false);
  React.useEffect(() => {
    const prev = prevView.current;
    prevView.current = subView;
    if (prev === subView) return;
    router.setParams({ view: subView } as never);
    if (poppingBack.current) {
      poppingBack.current = false;
      return;
    }
    const stack = viewHistory.current;
    // An in-app return to the previous tab counts as going back, so it doesn't loop.
    if (stack[stack.length - 1] === subView) stack.pop();
    else stack.push(prev);
  }, [subView]);
  React.useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const prev = viewHistory.current.pop();
      if (!prev) return false;
      poppingBack.current = true;
      setSubView(prev);
      return true;
    });
    return () => subscription.remove();
  }, []);
  // Registry subView keys are PascalCase (sm-Composer → 'Composer').
  useScreenNumber({ subView: subView.charAt(0).toUpperCase() + subView.slice(1) });
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

  const menuItems = React.useMemo<MenuActionItem[]>(
    () => [
      {
        id: 'overview',
        helpId: 'sm_overview',
        label: 'Overview',
        isActive: subView === 'overview',
        onPress: () => setSubView('overview'),
      },
      {
        id: 'reviewLibrary',
        helpId: 'sm_reviews',
        label: 'Review Library',
        isActive: subView === 'reviewLibrary',
        onPress: () => setSubView('reviewLibrary'),
      },
      {
        id: 'pitchPicker',
        helpId: 'sm_pitch',
        label: 'Pitch Picker',
        isActive: subView === 'pitchPicker',
        onPress: () => setSubView('pitchPicker'),
      },
      {
        id: 'composer',
        helpId: 'sm_composer',
        label: 'Composer',
        isActive: subView === 'composer',
        onPress: () => setSubView('composer'),
      },
      {
        id: 'reporting',
        helpId: 'sm_reporting',
        label: 'Reporting',
        isActive: subView === 'reporting',
        onPress: () => setSubView('reporting'),
      },
      {
        id: 'callbackTasks',
        helpId: 'sm_callbacks',
        label: 'Callback tasks',
        isActive: subView === 'callbackTasks',
        onPress: () => setSubView('callbackTasks'),
      },
      {
        id: 'payroll',
        helpId: 'payroll',
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

  const gearItems = React.useMemo<MenuActionItem[]>(
    () => [
      { id: 'gearLogin', helpId: 'account', label: 'Sign Out', onPress: () => router.push('/account') },
      { id: 'gearSettings', helpId: 'settings', label: 'Settings', onPress: () => router.push('/config/settings') },
      { id: 'gearProfile', helpId: 'profile', label: 'Profile', onPress: () => router.push('/profile') },
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
      helpContext: { screenKey: HELP_SCREEN_KEYS[subView] ?? 'sm-overview' },
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
