import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack, useRootNavigationState, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { LoadingState, ErrorState, EmptyState, Button, colors, spacing } from '@jobcore/ui';

import { SessionProvider, useSession, signOut } from '../src/lib/session';
import { SyncStatusProvider } from '../src/lib/sync-status';
import { SyncIndicator } from '../src/components/SyncIndicator';
import { countPending } from '../src/lib/offline-db';
import { installGlobalErrorHandler } from '../src/lib/global-error-handler';
import { WalkthroughProvider } from '../src/walkthrough/WalkthroughProvider';
import { WalkthroughOverlay } from '../src/walkthrough/WalkthroughOverlay';

// Side-effect import: registers every compiled-in module exactly once, before any
// screen calls getEnabledModules(). This is the only import of this file in the app.
import '../src/modules';

installGlobalErrorHandler();

SplashScreen.preventAutoHideAsync();

/**
 * Auth gate. Reads the session state and decides what the router may render:
 *   loading         → centered spinner
 *   error           → cold-start failure: message + retry
 *   disabled        → account deactivated: message + sign-out
 *   unprovisioned   → signed in, no profile row: message + sign-out
 *   unauthenticated → redirect to /sign-in (unless already there)
 *   authenticated   → the Stack (redirects to / if still sitting on /sign-in)
 */
function AuthGate() {
  const state = useSession();
  const segments = useSegments();
  const onSignIn = segments[0] === 'sign-in' || segments[0] === 'sign-up';
  const rootNavigationState = useRootNavigationState();
  const navigationReady = !!rootNavigationState?.key;

  // The Stack must always mount unconditionally — expo-router's root navigation
  // state only becomes ready AFTER a navigator (this Stack) has mounted and
  // registered with the underlying navigation container. Gating the Stack's
  // render behind `navigationReady` creates a deadlock: the key can never
  // resolve because the thing that produces it is never allowed to mount.
  // Loading/error/empty states are rendered as an overlay on top of the Stack
  // instead. The only thing that still needs to wait for `navigationReady` is
  // the `<Redirect>` call below, since expo-router throws if you navigate
  // before the root layout has finished its own first mount.
  let overlay = null;

  if (!navigationReady) {
    overlay = (
      <View style={styles.center}>
        <LoadingState label="Loading…" />
      </View>
    );
  } else if (state.status === 'loading') {
    overlay = (
      <View style={styles.center}>
        <LoadingState label="Loading…" />
      </View>
    );
  } else if (state.status === 'error') {
    overlay = (
      <View style={styles.center}>
        <ErrorState message={state.message} onRetry={state.retry} />
      </View>
    );
  } else if (state.status === 'disabled') {
    overlay = (
      <View style={styles.center}>
        <EmptyState
          title="Account deactivated"
          message="Your account has been deactivated. Contact your admin for help."
        />
        <Button label="Sign out" variant="outline" onPress={() => void signOut()} style={styles.signOut} />
      </View>
    );
  } else if (state.status === 'unprovisioned') {
    overlay = (
      <View style={styles.center}>
        <EmptyState
          title="Account not set up"
          message="Your sign-in worked, but no profile has been created for you yet. Ask your admin to finish setting up your account."
        />
        <Button label="Sign out" variant="outline" onPress={() => void signOut()} style={styles.signOut} />
      </View>
    );
  } else if (state.status === 'unauthenticated' && !onSignIn) {
    overlay = <Redirect href="/sign-in" />;
  } else if (state.status === 'authenticated' && onSignIn) {
    overlay = <Redirect href="/" />;
  }

  const isRedirect =
    overlay !== null &&
    navigationReady &&
    ((state.status === 'unauthenticated' && !onSignIn) || (state.status === 'authenticated' && onSignIn));

  return (
    <View style={styles.flex}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="m/[moduleId]" />
      </Stack>
      {overlay && !isRedirect ? (
        <View pointerEvents="auto" style={StyleSheet.absoluteFill}>
          {overlay}
        </View>
      ) : null}
      {isRedirect ? overlay : null}
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
  const [fontsLoaded, fontError] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <WalkthroughProvider>
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
      <WalkthroughOverlay />
    </WalkthroughProvider>
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
