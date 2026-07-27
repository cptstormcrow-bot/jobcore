import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { JobcoreModule } from '@jobcore/module-sdk';
import { colors, spacing, typography } from '@jobcore/ui';

/**
 * P1 placeholder screen for the field-tech module (build item 7).
 * Real screens land in P4 — this exists to prove the registry contract:
 * the shell renders whatever `routes[0].component` is, with zero knowledge of
 * which module it belongs to.
 */
function FieldTechScreen() {
  return React.createElement(
    View,
    { style: styles.screen },
    React.createElement(Text, { style: styles.title }, 'Field Tech'),
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
export const fieldTechModule: JobcoreModule = {
  id: 'field-tech',
  displayName: 'Field Tech',
  requiredRoles: ['owner', 'admin', 'tech'],
  routes: [{ path: 'field-tech', component: FieldTechScreen }],
  navEntries: [{ icon: 'construct', label: 'Field Tech', order: 20 }],
};

export default fieldTechModule;
