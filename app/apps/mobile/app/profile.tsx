// JobCore screen #0072 - profile - Profile
import React, { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import {
  AppChrome,
  Card,
  PayrollButton,
  ErrorState,
  LoadingState,
  colors,
  spacing,
  compact,
  typography,
  radius,
  Text,
} from '@jobcore/ui';

import { useSession, updatePassword, updateFullName, updateEmail } from '../src/lib/session';
import { setPin, isValidPin, hasCustomPin, PIN_MAX } from '../src/lib/offline-auth';

const DASH = '—';
const MIN_LENGTH = 8;

export default function ProfileScreen() {
  const state = useSession();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsNote, setDetailsNote] = useState<string | null>(null);
  const loadedName = state.status === 'authenticated' ? state.profile.fullName || '' : '';
  const loadedEmail = state.status === 'authenticated' ? state.session.user.email || '' : '';

  useEffect(() => {
    setNameInput((prev) => (prev === '' ? loadedName : prev));
    setEmailInput((prev) => (prev === '' ? loadedEmail : prev));
  }, [loadedName, loadedEmail]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaved, setPinSaved] = useState(false);
  const [pinCustom, setPinCustom] = useState(false);
  const pinUserId = state.status === 'authenticated' ? state.session.user.id : null;

  useEffect(() => {
    if (!pinUserId) return;
    let active = true;
    void hasCustomPin(pinUserId).then((v) => {
      if (active) setPinCustom(v);
    });
    return () => {
      active = false;
    };
  }, [pinUserId, pinSaved]);

  if (state.status !== 'authenticated') {
    return (
      <View style={styles.center}>
        <LoadingState />
      </View>
    );
  }

  const { profile } = state;
  const role = profile.role || DASH;
  const userId = state.session.user.id;
  const sessionEmail = state.session.user.email || '';

  async function handleSaveDetails() {
    setDetailsNote(null);
    setDetailsError(null);
    const trimmedName = nameInput.trim();
    const trimmedEmail = emailInput.trim();
    if (trimmedName === '') {
      setDetailsError('Name cannot be empty.');
      return;
    }
    setDetailsBusy(true);
    const err = await updateFullName(userId, trimmedName);
    if (err !== null) {
      setDetailsBusy(false);
      setDetailsError(err);
      return;
    }
    await state.recheck();
    if (trimmedEmail !== '' && trimmedEmail.toLowerCase() !== sessionEmail.toLowerCase()) {
      const eErr = await updateEmail(trimmedEmail);
      setDetailsBusy(false);
      if (eErr !== null) {
        setDetailsError(eErr);
        return;
      }
      setDetailsNote('Check your email to confirm the change.');
      return;
    }
    setDetailsBusy(false);
    setDetailsNote('Details saved.');
  }

  async function handleSavePin() {
    setPinSaved(false);
    if (!isValidPin(newPin)) {
      setPinError('PIN must be 4 to 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }
    setPinBusy(true);
    setPinError(null);
    const message = await setPin(userId, newPin);
    setPinBusy(false);
    if (message !== null) {
      setPinError(message);
      return;
    }
    setNewPin('');
    setConfirmPin('');
    setPinSaved(true);
  }

  async function handleSubmit() {
    setSuccess(false);
    if (newPw.length < MIN_LENGTH) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    const message = await updatePassword(newPw);
    setBusy(false);
    if (message !== null) {
      setError(message);
      return;
    }
    setNewPw('');
    setConfirmPw('');
    setSuccess(true);
  }

  return (
    <View style={styles.screen}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Profile' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Profile' }}
        helpContext={{ screenKey: 'profile' }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            autoCapitalize="words"
            accessibilityLabel="Name"
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!detailsBusy}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={emailInput}
            onChangeText={setEmailInput}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            accessibilityLabel="Email"
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!detailsBusy}
          />
          <Text style={styles.label}>Role</Text>
          <Text style={[styles.value, styles.role]}>{role}</Text>
          <Text style={styles.note}>Only an admin can change roles.</Text>

          <PayrollButton
            label={detailsBusy ? 'Saving…' : 'Save details'}
            disabled={detailsBusy}
            onPress={() => void handleSaveDetails()}
            style={styles.submit}
          />

          {detailsNote !== null ? <Text style={styles.success}>{detailsNote}</Text> : null}
          {detailsError !== null ? <ErrorState title="Details not saved" message={detailsError} /> : null}
        </Card>

        <Card style={styles.form}>
          <Text style={styles.heading}>Change password</Text>

          <Text style={styles.label}>New password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              secureTextEntry={!showPw}
              placeholder="New password"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.passwordInput]}
              editable={!busy}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowPw((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showPw ? 'Hide new password' : 'Show new password'}
            >
              <Text style={styles.passwordToggleText}>{showPw ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Confirm password</Text>
          <View style={styles.passwordWrap}>
          <TextInput
            value={confirmPw}
            onChangeText={setConfirmPw}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            secureTextEntry={!showConfirm}
            placeholder="Confirm password"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.passwordInput]}
            editable={!busy}
          />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowConfirm((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              <Text style={styles.passwordToggleText}>{showConfirm ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <PayrollButton
            label={busy ? 'Updating…' : 'Update password'}
            disabled={busy}
            onPress={() => void handleSubmit()}
            style={styles.submit}
          />

          {success ? <Text style={styles.success}>Password updated</Text> : null}
          {error !== null ? <ErrorState title="Password not updated" message={error} /> : null}
        </Card>

        <Card style={styles.form}>
          <Text style={styles.heading}>Offline PIN</Text>
          <Text style={styles.note}>
            {pinCustom
              ? 'Your own PIN signs you in with no wifi or cell service.'
              : 'Your PIN is 1111 until you change it. Set your own below.'}
          </Text>

          <Text style={styles.label}>New PIN</Text>
          <TextInput
            value={newPin}
            onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, PIN_MAX))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_MAX}
            accessibilityLabel="New PIN"
            placeholder="4 to 6 digits"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!pinBusy}
          />
          <Text style={styles.label}>Confirm PIN</Text>
          <TextInput
            value={confirmPin}
            onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, PIN_MAX))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_MAX}
            accessibilityLabel="Confirm PIN"
            placeholder="Confirm PIN"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!pinBusy}
          />

          <PayrollButton
            label={pinBusy ? 'Saving…' : 'Save PIN'}
            disabled={pinBusy}
            onPress={() => void handleSavePin()}
            style={styles.submit}
          />

          {pinSaved ? <Text style={styles.success}>PIN saved</Text> : null}
          {pinError !== null ? <ErrorState title="PIN not saved" message={pinError} /> : null}
        </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
  },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  form: { gap: spacing.xs },
  heading: {
    color: colors.primary,
    fontSize: typography.size.h2,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
  },
  label: {
    color: colors.textLight,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
  },
  value: {
    color: colors.text,
    fontSize: typography.size.body,
    marginTop: spacing.xs,
  },
  role: { textTransform: 'capitalize' },
  note: {
    color: colors.textLight,
    fontSize: typography.size.label,
    marginTop: spacing.xs,
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
  submit: { marginTop: spacing.lg },
  success: {
    color: colors.primary,
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
  },
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
