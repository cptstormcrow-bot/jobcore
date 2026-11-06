import { Alert, Linking, Platform } from 'react-native';

// Promoted from app/modules/field-tech/src/screens/FieldJobDetail.tsx's
// local telUrl() helper so it can be shared via @jobcore/ui.
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/**
 * Display form of a phone number with dashes, e.g. 5551234567 -> 555-123-4567.
 * A leading US "1" / "+1" is dropped. Anything that is not 10 digits is returned
 * trimmed but otherwise untouched, so an odd number is never mangled.
 */
export function formatPhone(phone: string | null | undefined): string {
  const raw = (phone ?? '').trim();
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return raw;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Every call started from inside the app goes through here: ask "Call 555-123-4567?"
 * first, and only open the dialer (then run `onCalled`) when the user confirms.
 */
export function confirmCall(phone: string, onCalled?: () => void): void {
  const shown = formatPhone(phone) || phone;
  const dial = (): void => {
    void Linking.openURL(telUrl(phone));
    onCalled?.();
  };
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(`Call ${shown}?`) : false;
    if (ok) dial();
    return;
  }
  Alert.alert(`Call ${shown}?`, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Call', onPress: dial },
  ]);
}
