import React from 'react';
import { View, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, compact, spacing, typography } from './tokens';

export interface LoadingStateProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({ label, style }: LoadingStateProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  label: { color: colors.textMuted, fontSize: typography.text.body, marginTop: compact.section },
});
