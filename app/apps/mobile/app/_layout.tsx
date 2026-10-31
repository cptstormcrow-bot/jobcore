// JobCore screen #0001 - root-layout - Root Layout
import React, { useEffect, useRef, useState, type ComponentProps } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Stack, useRootNavigationState, useRouter, useSegments, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { LoadingState, ErrorState, EmptyState, Button, colors, spacing, WalkthroughProvider, WalkthroughOverlay, WalkthroughHelpCallout, AppVersionProvider, ScreenNumberProvider, ScreenNumberBadge } from '@jobcore/ui';
import screenRegistry from '../src/screens/screen-registry.json';
import { getAppVersion } from '../src/lib/appVersion';
import { landingRouteFor } from '../src/lib/landing';

import { SessionProvider, useSession, signOut } from '../src/lib/session';
import { getEnabledModules } from '@jobcore/module-sdk';
import { SyncStatusProvider } from '../src/lib/sync-status';
import { ReadCacheProvider } from '../src/lib/read-cache';
import { SyncIndicator } from '../src/components/SyncIndicator';
import { SyncOptionsProvider } from '../src/components/SyncOptionsProvider';
import { installGlobalErrorHandler } from '../src/lib/global-error-handler';
import '../src/lib/background-sync'; // native-only task definition + registration (no-op on web)

// Side-effect import: registers every compiled-in module exactly once, before any
// screen calls getEnabledModules(). This is the only import of this file in the app.
import '../src/modules';

installGlobalErrorHandler();

const APP_VERSION = getAppVersion();

SplashScreen.preventAutoHideAsync();

// Sales-role users may only be on these paths (plus /m/sales-marketing itself). New Sales routes must be added here.
const SALES_ALLOWED = ['/account', '/config/settings', '/profile', '/sync-issues'];
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
 *   authenticated   → the Stack; from /, /sign-in or /sign-up, replaces to the role landing route
 */
function AuthGate() {
  const state = useSession();
  const segments = useSegments();
  const pathname = usePathname();
  const onSignIn = segments[0] === 'sign-in' || segments[0] === 'sign-up';
  const onRecovery = segments[0] === 'forgot-password' || segments[0] === 'reset-password';
  const rootNavigationState = useRootNavigationState();
  const navigationReady = !!rootNavigationState?.key;
  const router = useRouter();
  const [checkingAgain, setCheckingAgain] = useState(false);
  const salesBlocked =
    state.status === 'authenticated' && state.profile.role === 'sales' && !onRecovery && !isSalesAllowed(pathname);
  // Role landing: one path for fresh login and relaunch. Same role/module source as before
  // (state.profile.role + getEnabledModules(state.organization, role)).
  const landingTarget =
    state.status === 'authenticated'
      ? landingRouteFor(
          state.profile.role,
          getEnabledModules(state.organization, state.profile.role).map((m) => m.id),
        )
      : null;
  const needsLanding =
    navigationReady && landingTarget !== null && (onSignIn || pathname === '/') && pathname !== landingTarget;
  // Land at most once per sign-in: a repeated replace to the same target looped on Firefox web.
  const landedRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== 'authenticated') landedRef.current = null;
  }, [state.status]);
  useEffect(() => {
    if (!needsLanding || !landingTarget || salesBlocked || landedRef.current === landingTarget) return;
    landedRef.current = landingTarget;
    router.replace(landingTarget as never);
  }, [needsLanding, landingTarget, salesBlocked, router]);

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
  } else if (state.status === 'unauthenticated' && !onSignIn && !onRecovery) {
    overlay = <Redirect href="/sign-in" />;
  } else if (salesBlocked) {
    overlay = <Redirect href="/m/sales-marketing" />;
  } else if (needsLanding && landedRef.current !== landingTarget) {
    overlay = (
      <View style={styles.center}>
        <LoadingState label="Loading…" />
      </View>
    );
  }

  const isRedirect =
    overlay !== null &&
    navigationReady &&
    ((state.status === 'unauthenticated' && !onSignIn && !onRecovery) || salesBlocked);

  return (
    <View style={styles.flex}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="m" />
      </Stack>
      {overlay && !isRedirect ? (
        <View pointerEvents="auto" style={StyleSheet.absoluteFill}>
          {overlay}
        </View>
      ) : null}
      {isRedirect ? overlay : null}
      <ScreenNumberBadge pathname={pathname} />
      {state.status === 'authenticated' ? <SyncIndicator /> : null}
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
      <ScreenNumberProvider registry={screenRegistry as ComponentProps<typeof ScreenNumberProvider>['registry']}>
        <SafeAreaProvider>
          <SessionProvider>
            {/* Mount order: Session -> SyncStatus -> ReadCache -> AuthGate. */}
            <SyncStatusProvider>
              <SyncOptionsProvider>
                <ReadCacheProvider>
                  <StatusBar style="auto" />
                  <AuthGate />
                </ReadCacheProvider>
              </SyncOptionsProvider>
            </SyncStatusProvider>
          </SessionProvider>
        </SafeAreaProvider>
        <WalkthroughOverlay />
        <WalkthroughHelpCallout />
      </ScreenNumberProvider>
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
});
