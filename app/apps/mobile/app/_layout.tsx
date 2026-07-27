import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LoadingState, ErrorState, EmptyState, Button, colors, spacing } from '@jobcore/ui';

import { SessionProvider, useSession, signOut } from '../src/lib/session';

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="m/[moduleId]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <AuthGate />
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
});
