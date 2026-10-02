import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack, useRootNavigationState, useRouter, useSegments, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LoadingState, ErrorState, EmptyState, Button, colors, spacing, WalkthroughProvider, WalkthroughOverlay, AppVersionProvider } from '@jobcore/ui';
import { getAppVersion } from '../src/lib/appVersion';

import { SessionProvider, useSession, signOut } from '../src/lib/session';
import { getEnabledModules } from '@jobcore/module-sdk';
import { SyncStatusProvider } from '../src/lib/sync-status';
import { SyncIndicator } from '../src/components/SyncIndicator';
import { countPending } from '../src/lib/offline-db';
import { installGlobalErrorHandler } from '../src/lib/global-error-handler';

// Side-effect import: registers every compiled-in module exactly once, before any
// screen calls getEnabledModules(). This is the only import of this file in the app.
import '../src/modules';

installGlobalErrorHandler();

const APP_VERSION = getAppVersion();

SplashScreen.preventAutoHideAsync();

// Sales-role users may only be on these paths (plus /m/sales-marketing itself). New Sales routes must be added here.
const SALES_ALLOWED = ['/account', '/config/settings', '/profile'];
function isSalesAllowed(p: string): boolean {
  return p === '/m/sales-marketing' || p.startsWith('/m/sales-marketing/') || SALES_ALLOWED.includes(p);
}

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
  const pathname = usePathname();
  const onSignIn = segments[0] === 'sign-in' || segments[0] === 'sign-up';
  const rootNavigationState = useRootNavigationState();
  const navigationReady = !!rootNavigationState?.key;
  const router = useRouter();
  const [checkingAgain, setCheckingAgain] = useState(false);
  const salesBlocked =
    state.status === 'authenticated' && state.profile.role === 'sales' && !isSalesAllowed(pathname);

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
    const email = state.session.user.email ?? 'this account';
    overlay = (
      <View style={styles.center}>
        <EmptyState
          title="Account not set up"
          message={`Signed in as ${email}.\n\nYour sign-in worked, but no profile has been created for you yet. Ask your admin to finish setting up your account. Ask your admin to invite this exact email address.`}
        />
        <Button
          label={checkingAgain ? 'Checking…' : 'Check again'}
          variant="outline"
          disabled={checkingAgain}
          onPress={() => {
            setCheckingAgain(true);
            void state.recheck().finally(() => setCheckingAgain(false));
          }}
          style={styles.signOut}
        />
        <Button
          label="Sign in as someone else"
          variant="outline"
          onPress={() => {
            void (async () => {
              await signOut();
              router.replace('/sign-in');
            })();
          }}
          style={styles.signOut}
        />
      </View>
    );
  } else if (state.status === 'unauthenticated' && !onSignIn) {
    overlay = <Redirect href="/sign-in" />;
  } else if (salesBlocked) {
    overlay = <Redirect href="/m/sales-marketing" />;
  } else if (state.status === 'authenticated' && onSignIn && state.profile.role === 'admin' && getEnabledModules(state.organization, 'admin').some((m) => m.id === 'admin-finance')) {
    overlay = <Redirect href="/m/admin-finance" />;
  } else if (state.status === 'authenticated' && onSignIn) {
    overlay = <Redirect href="/" />;
  }

  const isRedirect =
    overlay !== null &&
    navigationReady &&
    ((state.status === 'unauthenticated' && !onSignIn) || (state.status === 'authenticated' && onSignIn) || salesBlocked);

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
    Inter_600SemiBold,
    Inter_700Bold,
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
    <AppVersionProvider value={APP_VERSION}>
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
    </AppVersionProvider>
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
