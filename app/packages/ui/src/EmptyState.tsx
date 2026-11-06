import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { useRouter } from 'expo-router';
import { PayrollButton } from './PayrollButton';
import { colors, compact, spacing, typography } from './tokens';

/** Signed-out button: any empty state whose message starts "Sign in to" gets a way out. */
export function SignInButton() {
  const router = useRouter();
  return <PayrollButton label="Sign in" onPress={() => router.replace('/sign-in')} style={{ marginTop: compact.section }} />;
}

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ title, message, icon, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {message && message.startsWith('Sign in to') ? <SignInButton /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: compact.section },
  icon: { marginBottom: compact.section },
  title: {
    color: colors.text,
    fontSize: typography.text.title,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.text.body,
    textAlign: 'center',
    lineHeight: typography.lineHeight.body * typography.text.body,
    marginTop: compact.field,
  },
});
