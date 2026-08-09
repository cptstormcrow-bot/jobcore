/**
 * sales-marketing module registration (P6).
 *
 * Mirrors `modules/field-tech/src/index.ts`'s layering: this file only
 * assembles the `JobcoreModule` object and exports it — the host
 * (`apps/mobile/src/modules.ts`) is the sole caller of `registerModule`,
 * exactly as it is for `fieldTechModule`/`adminFinanceModule`.
 *
 * Supersedes the P1 placeholder (`SalesMarketingScreen`). Real screens
 * (Review Library, Pitch Picker, Composer, Reporting) have not landed yet —
 * they are a later pass. Importing `./screens/SalesMarketingRoot`,
 * `./screens/ReviewLibrary`, `./screens/PitchPicker`, `./screens/Composer`,
 * or `./screens/Reporting` directly here would hard-fail the build before
 * those files exist, so this file keeps a placeholder root in their place.
 * When the screens land, replace `SalesMarketingPlaceholder` with a real
 * import of `./screens/SalesMarketingRoot`, following field-tech's
 * direct-import pattern exactly.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { JobcoreModule } from '@jobcore/module-sdk';
import { colors, spacing, typography } from '@jobcore/ui';

/**
 * Placeholder root, standing in for `./screens/SalesMarketingRoot` until
 * S-series work lands Review Library / Pitch Picker / Composer / Reporting.
 * Replace with a real import once those screens exist — do not add logic
 * here; this component is scaffolding only.
 */
function SalesMarketingPlaceholder() {
  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(Text, { style: styles.title }, 'Sales & Marketing'),
    React.createElement(Text, { style: styles.body }, 'Placeholder screen. Built out in a later phase.')
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.offWhite,
  },
  title: {
    color: colors.primary,
    fontSize: typography.size.h3,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

/**
 * Module ids are pinned byte-for-byte by supabase/seed.sql's
 * organizations.enabled_modules value — do not rename.
 *
 * requiredRoles gates sales-marketing to sales, admin, and owner — a tech
 * sees no Sales & Marketing entry, mirroring field-tech's role-gating
 * approach (P1 AC-3 / verification step 2).
 */
export const salesMarketingModule: JobcoreModule = {
  id: 'sales-marketing',
  displayName: 'Sales & Marketing',
  requiredRoles: ['sales', 'admin', 'owner'],
  routes: [{ path: 'sales-marketing', component: SalesMarketingPlaceholder }],
  navEntries: [{ icon: 'megaphone', label: 'Sales & Marketing', order: 30 }],
  migrations: [],
};

export default salesMarketingModule;
