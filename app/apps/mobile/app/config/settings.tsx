// JobCore screen #0065 - config-settings - Settings
import React from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { AppChrome, EmptyState, Text, spacing, colors, typography, useAppVersion, formatVersionLabel, useScreenNumber } from '@jobcore/ui';

export default function SettingsScreen() {
  const appVersion = useAppVersion();
  const { enabled, setEnabled } = useScreenNumber();
  return (
    <View style={styles.container}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Configuration' }, { label: 'Settings' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Settings', subtitle: 'Configuration' }}
        helpContext={{ screenKey: 'settings' }}
      />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Show screen numbers</Text>
        <Switch
          testID="show-screen-numbers-switch"
          accessibilityLabel="Show screen numbers"
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
  },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
