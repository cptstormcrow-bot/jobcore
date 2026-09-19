import * as Clipboard from 'expo-clipboard';

export function copyToClipboard(text: string): void {
  void Clipboard.setStringAsync(text).catch(() => {});
}
