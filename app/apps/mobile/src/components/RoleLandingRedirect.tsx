import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { getEnabledModules } from '@jobcore/module-sdk';
import { LoadingState, colors } from '@jobcore/ui';

import { useSession } from '../lib/session';
import { landingRouteFor } from '../lib/landing';

/**
 * Screen-less redirect: loading -> spinner, signed out -> /sign-in,
 * signed in -> role landing route. Used by `/` and the not-found route.
 */
export function RoleLandingRedirect() {
  const state = useSession();

  if (state.status === 'authenticated') {
    const { organization, profile } = state;
    const ids = getEnabledModules(organization, profile.role).map((m) => m.id);
    return <Redirect href={landingRouteFor(profile.role, ids) as never} />;
  }
  if (state.status === 'unauthenticated') {
    return <Redirect href="/sign-in" />;
  }
  return (
    <View style={styles.center}>
      <LoadingState />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.offWhite },
});
