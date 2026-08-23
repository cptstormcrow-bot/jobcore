import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, typography } from './tokens';

export interface ScreenTitleProps {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

export function ScreenTitle({ title, subtitle, style }: ScreenTitleProps) {
  return (
    <View style={style}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.size.label,
  },
});
