import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getEnabledModules } from '@jobcore/module-sdk';
import { EmptyState, LoadingState, colors } from '@jobcore/ui';

import { useSession } from '../../src/lib/session';

/**
 * Static route file + dynamic segment.
 *
 * Expo Router has `typedRoutes: true`, so route files must exist at build time —
 * a module cannot mint its own. This one file resolves ANY module: it looks the
 * id up in the registry and renders whatever component that module contributed,
 * with zero knowledge of which module it is.
 *
 * Resolution goes through `getEnabledModules`, not a raw registry lookup, so a
 * deep link to a module the org has disabled — or that this role may not see —
 * lands on the empty state instead of rendering. The role gate is UI-level only;
 * RLS is the actual access control.
 */
export default function ModuleScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const state = useSession();

  // The root layout gates on status, so this branch is defensive only.
  if (state.status !== 'authenticated') {
    return (
      <View style={styles.center}>
        <LoadingState />
      </View>
    );
  }

  const module = getEnabledModules(state.organization, state.profile.role).find((m) => m.id === moduleId);

  if (!module) {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Module unavailable"
          message="This module is not enabled for your organization, or your role cannot open it."
        />
      </View>
    );
  }

  const route = module.routes[0];

  if (!route) {
    return (
      <View style={styles.center}>
        <EmptyState title={module.displayName} message="This module has no screens yet." />
      </View>
    );
  }

  const Screen = route.component;

  return <Screen />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
  },
});
