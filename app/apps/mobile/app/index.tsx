import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, LoadingState, colors, spacing, typography } from '@jobcore/ui';

import { useSession, signOut } from '../src/lib/session';

/**
 * PLACEHOLDER home screen.
 *
 * S5 replaces this entirely with registry-driven navigation: the enabled
 * modules on the organization (`organization.enabledModules`) will be resolved
 * through the @jobcore/module-sdk registry and rendered as the nav surface.
 * Nothing here should be built on — it exists to prove the auth + session +
 * profile/organization round-trip end to end.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.body}>
        <Text style={styles.org}>{organization.name}</Text>
        <Text style={styles.subtitle}>Signed in</Text>

        <Card style={styles.card}>
          <Text style={styles.name}>{profile.fullName}</Text>
          <Text style={styles.role}>{profile.role}</Text>
          <Text style={styles.meta}>
            {organization.enabledModules.length} module
            {organization.enabledModules.length === 1 ? '' : 's'} enabled
          </Text>
        </Card>

        <Button label="Sign out" variant="outline" onPress={() => void signOut()} style={styles.signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.offWhite },
  body: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  org: {
    color: colors.primary,
    fontSize: typography.size.h2,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  card: { alignItems: 'center', gap: spacing.xs },
  name: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
  },
  role: {
    color: colors.secondary,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
  },
  meta: { color: colors.textMuted, fontSize: typography.size.small, marginTop: spacing.xs },
  signOut: { marginTop: spacing.xl },
});
