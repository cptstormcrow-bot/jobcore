import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppChrome, EmptyState, Text, spacing, colors, useAppVersion, formatVersionLabel } from '@jobcore/ui';

export default function SettingsScreen() {
  const appVersion = useAppVersion();
  return (
    <View style={styles.container}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Configuration' }, { label: 'Settings' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Settings', subtitle: 'Configuration' }}
      />
      <EmptyState
        title="Settings"
        message="Settings are coming soon."
      />
      <Text style={styles.version}>{formatVersionLabel(appVersion)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.offWhite,
    padding: spacing.md,
  },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
