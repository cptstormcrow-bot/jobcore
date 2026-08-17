import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, ErrorState, colors, spacing, typography, radius } from '@jobcore/ui';

import { signIn } from '../src/lib/session';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = email.length > 0 && password.length > 0 && !busy;

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    const message = await signIn(email, password);
    // On success the session listener swaps the route out from under us; only
    // the failure path needs to touch state here.
    if (message !== null) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.body}>
        <Text style={styles.title}>JobCore©</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <Card style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!busy}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.passwordInput]}
              editable={!busy}
              onSubmitEditing={() => {
                if (canSubmit) void handleSubmit();
              }}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowPassword((prev) => !prev)}
            >
              <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <Button
            label={busy ? 'Signing in…' : 'Sign in'}
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
            style={styles.submit}
          />
        </Card>

        {error !== null ? <ErrorState title="Sign-in failed" message={error} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  body: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: {
    color: colors.primary,
    fontSize: typography.size.h1,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  card: { gap: spacing.xs },
  label: {
    color: colors.textLight,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.body,
    color: colors.text,
    backgroundColor: colors.white,
  },
  submit: { marginTop: spacing.lg },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: spacing.lg * 2 },
  passwordToggle: {
    position: 'absolute',
    right: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  passwordToggleText: {
    color: colors.primary,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
  },
});
