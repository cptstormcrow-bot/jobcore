import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEnabledModules } from '@jobcore/module-sdk';
import { EmptyState, LoadingState, ScreenTitle, AppChrome, colors, spacing, typography } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';

import { useSession, signOut } from '../src/lib/session';

/**
 * Registry-driven launcher (P1 build item 6).
 *
 * This file contains ZERO hardcoded references to any specific module — every
 * entry comes from `getEnabledModules(organization, role)`, which intersects the
 * org's `enabled_modules` with the module's `requiredRoles`. Removing an id from
 * `organizations.enabled_modules` makes its entry disappear with no code change
 * (P1 AC-4), and each of the four roles resolves to a different set (AC-3).
 *
 * Tapping an entry pushes `/m/<id>`, the single static route file that renders
 * whichever component that module contributed.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const state = useSession();

  // The root layout gates on status, so this branch is defensive only.
  if (state.status !== 'authenticated') {
    return (
      <View style={styles.center}>
        <LoadingState />
      </View>
    );
  }

  const { organization, profile } = state;
  const modules = getEnabledModules(organization, profile.role);

  const menuItems: MenuItem[] = [
    ...modules.map((m) => ({ id: m.id, label: m.displayName, onPress: () => router.push(`/m/${m.id}`) })),
    { id: 'logins', label: 'Logins/Sign in/out', onPress: () => void signOut() },
    {
      id: 'configuration',
      label: 'Configuration',
      submenu: [
        { id: 'spawn-test-jobs', label: 'Spawn Test Jobs', onPress: () => router.push('/config/test-jobs') },
        { id: 'settings', label: 'Settings', onPress: () => router.push('/config/settings') },
      ],
    },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScreenTitle title="Home" />
      <View style={styles.header}>
        <Text style={styles.org}>{organization.name}</Text>
        <Text style={styles.who}>
          {profile.fullName} · {profile.role}
        </Text>
      </View>

      <AppChrome breadcrumbSegments={[{ label: 'Home' }]} menuItems={menuItems} optionsItems={[]} />

      {modules.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="No modules enabled"
            message="No modules are enabled for your organization, or none are available to your role. Contact your admin."
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
  },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  org: {
    color: colors.primary,
    fontSize: typography.size.h2,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
  },
  who: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  footer: { padding: spacing.lg },
});
