// JobCore screen #0080 - reset-password - New Password
import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorState, LoadingState, ScreenTitle, colors, spacing, typography, radius, Text } from '@jobcore/ui';

import { supabase } from '../src/lib/supabase';

const MIN_LEN = 8;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const readyRef = useRef(false);

  useEffect(() => {
    function markReady() {
      readyRef.current = true;
      setReady(true);
      setExpired(false);
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) markReady();
    });
    // The recovery link may already have been consumed (detectSessionInUrl) before we mounted.
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) markReady();
    });
    const t = setTimeout(() => {
      if (!readyRef.current) setExpired(true);
    }, 5000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const tooShort = password.length > 0 && password.length < MIN_LEN;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LEN && password === confirm && !busy;

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
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    // AuthGate replaces '/' with the role landing route.
    router.replace('/');
  }

  const fields = (
    <>
      <Text style={styles.label}>New password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        editable={!busy}
        nativeID="new-password"
      />
      {tooShort ? <Text style={styles.hint}>Use at least {MIN_LEN} characters.</Text> : null}

      <Text style={styles.label}>Confirm new password</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        editable={!busy}
        nativeID="confirm-password"
        onSubmitEditing={submit}
      />
      {mismatch ? <Text style={styles.hint}>Passwords do not match.</Text> : null}

      <Button
        label={busy ? 'Saving…' : 'Set new password'}
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
        <ScreenTitle title="New Password" subtitle="Choose a new password" />

        {ready ? (
          <Card style={styles.card}>
            {Platform.OS === 'web' ? (
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
        ) : expired ? (
          <Card style={styles.card}>
            <Text style={styles.label}>This reset link is invalid or expired</Text>
            <Button
              label="Request a new link"
              onPress={() => router.replace('/forgot-password')}
              style={styles.submit}
            />
          </Card>
        ) : (
          <LoadingState label="Checking your reset link…" />
        )}

        {error !== null ? <ErrorState title="Couldn't update password" message={error} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  body: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: { gap: spacing.xs },
  label: {
    color: colors.textLight,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
  },
  hint: { color: colors.textMuted, fontSize: typography.size.label },
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
});
