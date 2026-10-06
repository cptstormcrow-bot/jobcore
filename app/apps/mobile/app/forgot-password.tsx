import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, ErrorState, ScreenTitle, colors, spacing, typography, radius, Text } from '@jobcore/ui';

import { resetPassword } from '../src/lib/session';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0 && !busy;
  const formRef = useRef<HTMLFormElement>(null);
  function submit() {
    if (Platform.OS === 'web' && formRef.current) {
      formRef.current.requestSubmit();
      return;
    }
    if (canSubmit) void handleSubmit();
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    const message = await resetPassword(email.trim());
    setBusy(false);
    if (message !== null) setError(message);
    else setSent(true);
  }

  const fields = (
    <>
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
        nativeID="email"
        onSubmitEditing={submit}
      />
      <Button
        label={busy ? 'Sending…' : 'Send reset link'}
        disabled={!canSubmit}
        onPress={submit}
        style={styles.submit}
      />
    </>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.body}>
        <ScreenTitle title="Reset Password" subtitle="We will email you a reset link" />

        <Card style={styles.card}>
          {sent ? (
            <>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.label}>
                If an account exists for {email.trim()}, a reset link is on its way.
              </Text>
              <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} style={styles.submit} />
            </>
          ) : Platform.OS === 'web' ? (
            <form
              ref={formRef}
              style={{ display: 'contents' }}
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) void handleSubmit();
              }}
            >
              {fields}
            </form>
          ) : (
            fields
          )}
        </Card>

        {!sent ? (
          <View style={styles.link}>
            <Button variant="outline" size="sm" label="Back to sign in" onPress={() => router.replace('/sign-in')} />
          </View>
        ) : null}

        {error !== null ? <ErrorState title="Couldn't send reset link" message={error} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  body: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { gap: spacing.xs },
  heading: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.semibold },
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
  link: { marginTop: spacing.lg },
});
