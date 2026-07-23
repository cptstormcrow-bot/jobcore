import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LoadingState, colors } from '@jobcore/ui';

import { SessionProvider, useSession } from '../src/lib/session';

/**
 * Auth gate. Reads the session state and decides what the router may render:
 *   loading         → centered spinner
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

  if (state.status === 'unauthenticated' && !onSignIn) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" />
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
});
