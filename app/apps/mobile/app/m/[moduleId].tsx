import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getEnabledModules } from '@jobcore/module-sdk';
import { EmptyState, LoadingState, colors } from '@jobcore/ui';
import { setModuleSession, clearModuleSession } from '@jobcore/admin-finance';
import { setModulePorts as setAdminFinanceModulePorts } from '../../../../modules/admin-finance/src/lib/module-ports';
import {
  setModuleSession as setFieldTechModuleSession,
  clearModuleSession as clearFieldTechModuleSession,
} from '../../../../modules/field-tech/src/lib/module-session';
import { setModulePorts as setFieldTechModulePorts } from '../../../../modules/field-tech/src/lib/module-ports';

import { useSession } from '../../src/lib/session';
import { buildFieldTechPorts } from '../../src/lib/field-tech-repos';
import { buildAdminFinancePorts } from '../../src/lib/admin-finance-repos';

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

  // Host-side injection for the admin-finance module's session seam (P3e.1a,
  // the forward contract `module-session.ts` left open at P3d.2). admin-finance
  // cannot read the host's session union directly (see that file's doc
  // comment), so this is the ONLY place that narrows it and hands the module
  // an already-resolved `ModuleSession`. Cleared on unmount / module switch so
  // a stale session never lingers once this screen is no longer showing
  // admin-finance. Runs unconditionally (rules-of-hooks) — it's a no-op
  // whenever `state` isn't authenticated or the module isn't admin-finance.
  useEffect(() => {
    if (state.status === 'authenticated' && module?.id === 'admin-finance') {
      setModuleSession({
        org: state.organization,
        role: state.profile.role,
        userId: state.profile.id,
      });
      setAdminFinanceModulePorts(buildAdminFinancePorts());
      return () => clearModuleSession();
    }
    return undefined;
  }, [state, module?.id]);

  // Host-side injection for the field-tech module's session + ports seams
  // (P4.S2.2, the forward contracts `module-session.ts`/`module-ports.ts` left
  // open at P4.S1.2/S1.3). field-tech cannot read the host's session union or
  // construct its own repositories directly (module-isolation contract), so
  // this is the ONLY place that narrows the session and builds the Supabase-
  // backed ports (P4.S2.1) before handing both to the module. Cleared on
  // unmount / module switch so a stale session/ports set never lingers once
  // this screen is no longer showing field-tech. Runs unconditionally
  // (rules-of-hooks) — it's a no-op whenever `state` isn't authenticated or
  // the module isn't field-tech.
  useEffect(() => {
    if (state.status === 'authenticated' && module?.id === 'field-tech') {
      setFieldTechModuleSession({
        org: state.organization,
        role: state.profile.role,
        userId: state.profile.id,
      });
      setFieldTechModulePorts(buildFieldTechPorts());
      return () => clearFieldTechModuleSession();
    }
    return undefined;
  }, [state, module?.id]);

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
