import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LoadingState, ErrorState, EmptyState, Button, colors, spacing } from '@jobcore/ui';

import { SessionProvider, useSession, signOut } from '../src/lib/session';
import { SyncStatusProvider } from '../src/lib/sync-status';
import { SyncIndicator } from '../src/components/SyncIndicator';
import { countPending } from '../src/lib/offline-db';

// Side-effect import: registers every compiled-in module exactly once, before any
// screen calls getEnabledModules(). This is the only import of this file in the app.
import '../src/modules';

/**
 * Auth gate. Reads the session state and decides what the router may render:
 *   loading         → centered spinner
 *   error           → cold-start failure: message + retry
 *   disabled        → account deactivated: message + sign-out
 *   unprovisioned   → signed in, no profile row: message + sign-out
 *   unauthenticated → redirect to /sign-in (unless already there)
 *   authenticated   → the Stack
 */
function AuthGate() {
  const state = useSession();
  const segments = useSegments();
  const onSignIn = segments[0] === 'sign-in';

  if (state.status === 'loading') {
    return (
      <View style={styles.center}>
        <LoadingState label="Loading…" />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.center}>
        <ErrorState message={state.message} onRetry={state.retry} />
      </View>
    );
  }

  if (state.status === 'disabled') {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Account deactivated"
          message="Your account has been deactivated. Contact your admin for help."
        />
        <Button label="Sign out" variant="outline" onPress={() => void signOut()} style={styles.signOut} />
      </View>
    );
  }

  if (state.status === 'unprovisioned') {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Account not set up"
          message="Your sign-in worked, but no profile has been created for you yet. Ask your admin to finish setting up your account."
        />
        <Button label="Sign out" variant="outline" onPress={() => void signOut()} style={styles.signOut} />
      </View>
    );
  }

  if (state.status === 'unauthenticated' && !onSignIn) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <View style={styles.flex}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="m/[moduleId]" />
      </Stack>
      {/* headerShown: false means this app has no navigation header to hang a badge
          on, so the sync indicator is an absolutely-positioned overlay instead.
          pointerEvents="box-none" keeps the overlay from swallowing touches meant
          for the screen beneath it. */}
      <View pointerEvents="box-none" style={styles.syncOverlay}>
        <SyncIndicator />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        {/* Mounted at the root so the sync indicator is app-wide ("persistent")
            across every screen. `replay` is deliberately left unwired here until
            a Supabase transport exists. */}
        <SyncStatusProvider countPending={countPending}>
          <StatusBar style="auto" />
          <AuthGate />
        </SyncStatusProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
  },
  signOut: {
    marginTop: spacing.md,
  },
  flex: {
    flex: 1,
  },
  syncOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
    alignItems: 'center',
  },
});
