import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing, typography } from './tokens';

export interface FlagPillProps {
  label: string;
  testID?: string;
  accessibilityLabel?: string;
}

export function FlagPill({ label, testID, accessibilityLabel }: FlagPillProps) {
  return (
    <View
      style={styles.pill}
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={styles.text}>{'✓ ' + label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  text: {
    color: colors.white,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.bodySemibold,
    fontWeight: typography.weight.semibold,
  },
});
