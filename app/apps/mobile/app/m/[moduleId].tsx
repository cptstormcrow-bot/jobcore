// JobCore screen #0005 - module-host - Module Host
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
import {
  setModuleSession as setSalesMarketingModuleSession,
  clearModuleSession as clearSalesMarketingModuleSession,
  setModulePorts as setSalesMarketingModulePorts,
} from '../../../../modules/sales-marketing/src/index';
import { setSupabaseClient as setPaymentReviewSupabaseClient } from '@jobcore/payment-review';

import { useSession } from '../../src/lib/session';
import { buildAdminFinancePorts } from '../../src/lib/admin-finance-repos';
import { buildFieldTechPorts } from '../../src/lib/field-tech-repos';
import { buildSalesMarketingPorts } from '../../src/lib/sales-marketing-repos';
import { supabase } from '../../src/lib/supabase';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { JobTaskList } from '../../src/components/JobTaskList';

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
  // an already-resolved `ModuleSession`. Injected SYNCHRONOUSLY in the render
  // body, not a `useEffect` — React fires child effects before parent effects
  // on mount, so an effect here ran AFTER the module's own screen had already
  // mounted and read a stale (uninjected) session, producing a permanently
  // stuck screen (`.claude/plans/jobcore-mobile-sales-marketing-crash-fix-defensive-hardening.md` §1, which hit
  // this in sales-marketing's default screen). These setters are plain
  // module-scope variable writes — idempotent, no side-rendering — so calling
  // them unconditionally every render is safe; only the CLEANUP needs to stay
  // in an effect, scoped to `module?.id` alone so it fires on module switch /
  // unmount, not on every unrelated re-render of `state`.
  if (state.status === 'authenticated' && module?.id === 'admin-finance') {
    setModuleSession({
      org: state.organization,
      role: state.profile.role,
      userId: state.profile.id,
    });
    setAdminFinanceModulePorts(buildAdminFinancePorts({ orgId: state.organization.id, userId: state.profile.id }));
  }
  useEffect(() => {
    if (module?.id !== 'admin-finance') return undefined;
    return () => clearModuleSession();
  }, [module?.id]);

  // Host-side injection for the field-tech module's session + ports seams
  // (P4.S2.2, the forward contracts `module-session.ts`/`module-ports.ts` left
  // open at P4.S1.2/S1.3). field-tech cannot read the host's session union or
  // construct its own repositories directly (module-isolation contract), so
  // this is the ONLY place that narrows the session and builds the Supabase-
  // backed ports (P4.S2.1) before handing both to the module. See the
  // admin-finance block above for why this runs synchronously in render
  // rather than in a `useEffect`.
  if (state.status === 'authenticated' && module?.id === 'field-tech') {
    setFieldTechModuleSession({
      org: state.organization,
      role: state.profile.role,
      userId: state.profile.id,
    });
    setFieldTechModulePorts({
      ...buildFieldTechPorts({ orgId: state.organization.id, userId: state.profile.id }),
      renderTaskList: (p) => <JobTaskList {...p} source={p.source as 'plan' | 'prem' | 'estimate' | undefined} />,
    });
  }
  useEffect(() => {
    if (module?.id !== 'field-tech') return undefined;
    return () => clearFieldTechModuleSession();
  }, [module?.id]);

  // Host-side injection for the sales-marketing module's session + ports seams
  // (P6, mirroring field-tech's P4.S2.2 pattern). sales-marketing cannot read
  // the host's session union or construct its own repositories directly
  // (module-isolation contract), so this is the ONLY place that narrows the
  // session and builds the Supabase-backed ports before handing both to the
  // module. See the admin-finance block above for why this runs synchronously
  // in render rather than in a `useEffect`.
  if (state.status === 'authenticated' && module?.id === 'sales-marketing') {
    setSalesMarketingModuleSession({
      org: state.organization,
      role: state.profile.role,
      userId: state.profile.id,
    });
    setSalesMarketingModulePorts(buildSalesMarketingPorts({ orgId: state.organization.id, userId: state.profile.id }));
  }
  useEffect(() => {
    if (module?.id !== 'sales-marketing') return undefined;
    return () => clearSalesMarketingModuleSession();
  }, [module?.id]);

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
