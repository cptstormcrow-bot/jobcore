import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getEnabledModules } from '@jobcore/module-sdk';
import { Button, ListItem, EmptyState, LoadingState, colors, spacing, typography } from '@jobcore/ui';

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

  // navEntries are the nav surface; a module may contribute more than one.
  // Flattened and re-sorted here so ordering is global, not per-module.
  const entries = modules
    .flatMap((m) => m.navEntries.map((entry) => ({ moduleId: m.id, entry })))
    .sort((a, b) => a.entry.order - b.entry.order);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.org}>{organization.name}</Text>
        <Text style={styles.who}>
          {profile.fullName} · {profile.role}
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            title="No modules enabled"
            message="No modules are enabled for your organization, or none are available to your role. Contact your admin."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {entries.map(({ moduleId, entry }) => (
            <ListItem
              key={`${moduleId}:${entry.label}`}
              title={entry.label}
              onPress={() => router.push(`/m/${moduleId}`)}
              right={<Ionicons name={entry.icon as never} size={22} color={colors.secondary} />}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
      </View>
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
