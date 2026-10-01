import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getEnabledModules } from '@jobcore/module-sdk';
import { EmptyState, LoadingState, colors } from '@jobcore/ui';
import { useSession } from '../../src/lib/session';
import { useModuleInjection } from '../../src/lib/useModuleInjection';
import { setSupabaseClient as setPaymentReviewSupabaseClient } from '@jobcore/payment-review';
import { supabase } from '../../src/lib/supabase';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

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

  const module =
    state.status === 'authenticated'
      ? getEnabledModules(state.organization, state.profile.role).find((m) => m.id === moduleId)
      : undefined;

  // Host-side module session/ports injection (sync in render + cleanup effects);
  // see useModuleInjection for why.

  useModuleInjection(state, module?.id);


  // Host-side injection for payment-review's Supabase client seam. See the
  // admin-finance block above for why this runs synchronously in render.
  // Double cast: a direct cast trips TS2589 (supabase-js generics vs. port).
  if (state.status === 'authenticated' && module?.id === 'payment-review') {
    setPaymentReviewSupabaseClient(supabase as unknown as Parameters<typeof setPaymentReviewSupabaseClient>[0]);
  }
  useEffect(() => {
    if (module?.id !== 'payment-review') return undefined;
    return () => setPaymentReviewSupabaseClient(null);
  }, [module?.id]);

  // The root layout gates on status, so this branch is defensive only.
  if (state.status !== 'authenticated') {
    return (
      <View style={styles.center}>
        <LoadingState />
      </View>
    );
  }

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

  return (
    <ErrorBoundary>
      <Screen />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
  },
});
