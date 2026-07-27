import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { JobcoreModule } from '@jobcore/module-sdk';
import { colors, spacing, typography } from '@jobcore/ui';

/**
 * P1 placeholder screen for the sales-marketing module (build item 7).
 * Real screens land in P3/P6 — this exists to prove the registry contract:
 * the shell renders whatever `routes[0].component` is, with zero knowledge of
 * which module it belongs to.
 */
function SalesMarketingScreen() {
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
 * displayName / requiredRoles / navEntries are NOT specified by 00-MASTER-SPEC.md
 * or 01-P1-foundation.md. These values are a documented assumption chosen so that
 * all four seeded roles resolve to DIFFERENT nav sets (P1 AC-3) and a tech sees no
 * Admin entry (P1 verification step 2).
 */
export const salesMarketingModule: JobcoreModule = {
  id: 'sales-marketing',
  displayName: 'Sales & Marketing',
  requiredRoles: ['owner', 'sales'],
  routes: [{ path: 'sales-marketing', component: SalesMarketingScreen }],
  navEntries: [{ icon: 'megaphone', label: 'Sales & Marketing', order: 30 }],
};

export default salesMarketingModule;
