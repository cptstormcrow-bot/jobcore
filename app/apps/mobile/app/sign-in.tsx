// JobCore screen #0003 - sign-in - Sign In
import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Card, ErrorState, PayrollButton, ScreenTitle, colors, spacing, compact, typography, radius, Text } from '@jobcore/ui';

import NetInfo from '@react-native-community/netinfo';

import { signIn, isEmailNotConfirmed, resendConfirmation, enterOfflineSession, consumeOfflineLaunch } from '../src/lib/session';
import { listOfflineAccounts, offlineSignIn, PIN_MAX, type OfflineAccount } from '../src/lib/offline-auth';

const RECENT_EMAILS_KEY = 'jobcore.recentEmails';
const LEGACY_LAST_EMAIL_KEY = 'jobcore.lastEmail';
const MAX_RECENT = 3;

async function getRaw(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

// Remembers the last 3 emails only (never the password). Failures are silent.
async function readRecentEmails(): Promise<string[]> {
  const raw = await getRaw(RECENT_EMAILS_KEY);
  if (raw === null) {
    // One-time migration from the legacy single-email key.
    const legacy = await getRaw(LEGACY_LAST_EMAIL_KEY);
    const seed = legacy ? legacy.trim() : '';
    return seed ? [seed] : [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

async function writeRecentEmail(value: string): Promise<void> {
  const email = value.trim();
  if (!email) return;
  try {
    const existing = await readRecentEmails();
    const next = [
      email,
      ...existing.filter((e) => e.toLowerCase() !== email.toLowerCase()),
    ].slice(0, MAX_RECENT);
    const json = JSON.stringify(next);
    if (Platform.OS === 'web') window.localStorage.setItem(RECENT_EMAILS_KEY, json);
    else await SecureStore.setItemAsync(RECENT_EMAILS_KEY, json);
  } catch {
    // best-effort convenience only
  }
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  // Load recent emails once; pre-fill the most recent without clobbering anything already typed.
  useEffect(() => {
    let active = true;
    void readRecentEmails().then((saved) => {
      if (!active) return;
      setRecentEmails(saved);
      const first = saved[0];
      if (first) setEmail((current) => (current.length === 0 ? first : current));
    });
    return () => {
      active = false;
    };
  }, []);

  // Offline sign-in: remembered accounts + PIN, for when there is no wifi or cell service.
  const [accounts, setAccounts] = useState<OfflineAccount[]>([]);
  const [netOffline, setNetOffline] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(() => consumeOfflineLaunch());
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  useEffect(() => {
    let active = true;
    void listOfflineAccounts().then((list) => {
      if (!active) return;
      setAccounts(list);
      // One remembered account: pick it, so only the PIN is left to enter.
      if (list.length === 1) setPickedId((id) => id ?? list[0]!.userId);
    });
    const unsubscribe = NetInfo.addEventListener((net) => {
      if (active) setNetOffline(net.isConnected === false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const showOffline = accounts.length > 0 && (netOffline || offlineOpen);

  async function handleOfflineSignIn() {
    if (!pickedId) return;
    setBusy(true);
    setError(null);
    const result = await offlineSignIn(pickedId, pin);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      setPin('');
      return;
    }
    enterOfflineSession(result.snapshot);
  }

  const canSubmit = email.length > 0 && password.length > 0 && !busy;
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
    const message = await signIn(email, password);
    // On success the session listener swaps the route out from under us; only
    // the failure path needs to touch state here.
    if (message !== null) {
      // Weak or no signal (wifi with no internet, a timeout): do not strand the user on a password
      // error. If this device remembers an account, open the PIN sign-in right away.
      if (accounts.length > 0 && /timed out|network|failed to fetch|connection|unreachable/i.test(message)) {
        setOfflineOpen(true);
        setError('Could not reach the service. Sign in with your PIN below, or retry.');
      } else {
        setError(message);
      }
      setBusy(false);
    } else {
      void writeRecentEmail(email);
    }
  }

  const fields = (
    <>
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="username"
        keyboardType="email-address"
        textContentType="username"
        importantForAutofill="yes"
        placeholder="you@example.com"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        editable={!busy}
        nativeID="email"
      />
      {recentEmails
        .filter((e) => e !== email)
        .slice(0, MAX_RECENT)
        .map((e) => (
          <Pressable
            key={e}
            style={styles.recentEmail}
            accessibilityRole="button"
            accessibilityLabel={`Use ${e}`}
            onPress={() => setEmail(e)}
          >
            <Text style={styles.passwordToggleText}>{e}</Text>
          </Pressable>
        ))}

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          importantForAutofill="yes"
          secureTextEntry={!showPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.passwordInput]}
          editable={!busy}
          nativeID="password"
          onSubmitEditing={submit}
        />
        <Pressable
          style={styles.passwordToggle}
          onPress={() => setShowPassword((prev) => !prev)}
        >
          <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.forgotLink}
        accessibilityRole="link"
        accessibilityLabel="Forgot password? Reset your password"
        onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
      >
        <Text style={styles.passwordToggleText}>Forgot password?</Text>
      </Pressable>

      <PayrollButton
        label={busy ? 'Signing in…' : 'Sign in'}
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <ScreenTitle title="Sign In" subtitle="Sign in to continue" />

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

        {accounts.length > 0 && !showOffline ? (
          <View style={styles.signUpLink}>
            <PayrollButton label="Sign in offline" onPress={() => setOfflineOpen(true)} />
          </View>
        ) : null}

        {showOffline ? (
          <Card style={[styles.card, styles.signUpLink]}>
            <Text style={styles.heading}>Sign in offline</Text>
            <Text style={styles.label}>Pick your account</Text>
            {accounts.map((a) => (
              <Pressable
                key={a.userId}
                style={[styles.account, pickedId === a.userId && styles.accountPicked]}
                accessibilityRole="button"
                accessibilityLabel={`Use ${a.email}`}
                onPress={() => {
                  setPickedId(a.userId);
                  setPin('');
                  setError(null);
                }}
              >
                <Text style={styles.passwordToggleText} numberOfLines={1}>
                  {a.fullName ? `${a.fullName} · ${a.email}` : a.email}
                </Text>
              </Pressable>
            ))}
            {pickedId ? (
              <>
                <Text style={styles.label}>PIN</Text>
                <TextInput
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, PIN_MAX))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={PIN_MAX}
                  accessibilityLabel="PIN"
                  placeholder="PIN"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  editable={!busy}
                  onSubmitEditing={() => void handleOfflineSignIn()}
                />
                <PayrollButton
                  label={busy ? 'Signing in…' : 'Sign in with PIN'}
                  disabled={busy || pin.length < 4}
                  onPress={() => void handleOfflineSignIn()}
                  style={styles.submit}
                />
              </>
            ) : null}
          </Card>
        ) : null}

        <View style={styles.signUpLink}>
          <PayrollButton
            label="Create an account"
            onPress={() => router.push('/sign-up')}
          />
        </View>

        {error !== null && isEmailNotConfirmed(error) ? (
          <Card style={[styles.card, styles.signUpLink]}>
            <Text style={styles.heading}>Email not confirmed yet</Text>
            <Text style={styles.label}>
              Open the confirmation email we sent and tap its link, then sign in again. No email? Resend it.
            </Text>
            <PayrollButton
              label={resent ? 'Sent - check your email' : 'Resend confirmation email'}
              disabled={busy || resent || email.trim().length === 0}
              onPress={() => {
                void resendConfirmation(email).then((m) => {
                  if (m === null) setResent(true);
                  else setError(m);
                });
              }}
            />
          </Card>
        ) : error !== null ? (
          <ErrorState title="Sign-in failed" message={error} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  scroll: { flex: 1 },
  // Top-aligned in a scroll view so the keyboard never hides a field or button; on a tablet the card is centered, max 420 (Jeff 2026-11-05).
  body: { flexGrow: 1, padding: spacing.sm, width: '100%', maxWidth: 420, alignSelf: 'center' },
  card: { gap: spacing.xs },
  label: {
    color: colors.textLight,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: compact.field,
    fontSize: typography.text.input,
    color: colors.text,
    backgroundColor: colors.white,
  },
  submit: { marginTop: spacing.sm },
  heading: {
    color: colors.primary,
    fontSize: typography.size.h2,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
  },
  account: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
  },
  accountPicked: { borderColor: colors.primary },
  signUpLink: { marginTop: spacing.sm },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: spacing.lg * 2 },
  passwordToggle: {
    position: 'absolute',
    right: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  recentEmail: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  passwordToggleText: {
    color: colors.primary,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
  },
});
