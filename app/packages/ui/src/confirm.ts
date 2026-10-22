import { Alert, Platform } from 'react-native';

/**
 * Cross-platform "Are you sure?" prompt. Resolves true only when the user picks the
 * confirm button; Cancel (or dismissing the dialog) resolves false.
 * Lifted from the Test Jobs screen (#0066) so every screen can share it.
 */
export function confirmAsync(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Cross-platform notice. Alert.alert is a no-op on react-native-web, so web uses window.alert.
 */
export function notifyAsync(title: string, message: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [{ text: 'OK', onPress: () => resolve() }],
      { cancelable: true, onDismiss: () => resolve() },
    );
  });
}
