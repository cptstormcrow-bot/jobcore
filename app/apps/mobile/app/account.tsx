import React from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AppChrome, Card, Button, LoadingState, colors, spacing, typography, Text } from '@jobcore/ui';

import { useSession, signOut } from '../src/lib/session';

export default function AccountScreen() {
  const router = useRouter();
  const state = useSession();

  if (state.status !== 'authenticated') {
    return (
      <View style={styles.center}>
        <LoadingState />
      </View>
    );
  }

  const { organization, profile } = state;

  const confirmSignOut = () => {
    const doSignOut = async () => {
      await signOut();
      router.replace('/sign-in');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of JobCore?')) {
        void doSignOut();
      }
    } else {
      Alert.alert('Sign out', 'Sign out of JobCore?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void doSignOut() },
      ]);
    }
  };

  const confirmSwitchUser = () => {
    const doSwitchUser = async () => {
      await signOut();
      router.replace('/sign-in');
    };
    const title = 'Sign in as someone else';
    const body = 'This will sign you out and return to the sign-in screen.';

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${body}`)) {
        void doSwitchUser();
      }
    } else {
      Alert.alert(title, body, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => void doSwitchUser() },
      ]);
    }
  };

  return (
    <View style={styles.screen}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Account' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Account' }}
      />
      <View style={styles.content}>
        <Card>
          <Text style={styles.org}>{organization.name}</Text>
          <Text style={styles.who}>
            {profile.fullName} · {profile.role}
          </Text>
          <View style={styles.actions}>
            <Button label="Sign out" variant="accent" size="tab" style={styles.actionBtn} onPress={confirmSignOut} />
            <Button label="Sign in as someone else" variant="accent" size="tab" style={styles.actionBtn} onPress={confirmSwitchUser} />
          </View>
          <Text style={styles.note}>
            Each device signs in separately — signing out here does not affect other devices.
          </Text>
        </Card>
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
  content: { padding: spacing.lg, gap: spacing.md },
  org: {
    color: colors.primary,
    fontSize: typography.size.h2,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
  },
  who: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1, minWidth: 0 },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    marginTop: spacing.sm,
  },
});
