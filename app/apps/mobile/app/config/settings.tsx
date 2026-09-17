import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppChrome, EmptyState, spacing, colors } from '@jobcore/ui';

export default function SettingsScreen() {
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.offWhite,
    padding: spacing.md,
  },
});
