import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, typography } from './tokens';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, style }: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} style={styles.retry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: {
    color: colors.danger,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retry: { marginTop: spacing.md },
});
