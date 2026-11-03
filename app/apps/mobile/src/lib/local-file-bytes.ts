// Reads a photo picked or taken on this device for upload. On Android, fetch(file://).blob()
// fails ("Network request failed") and new Blob([bytes]) is unsupported, so native reads go
// through expo-file-system and hand the storage client raw bytes.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)]!;
    const b = LOOKUP[clean.charCodeAt(i + 1)]!;
    const c = LOOKUP[clean.charCodeAt(i + 2)] ?? 0;
    const d = LOOKUP[clean.charCodeAt(i + 3)] ?? 0;
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out;
}

/** The file's bytes (a Blob on web), or null when the file no longer exists. */
export async function readLocalBytes(uri: string): Promise<Uint8Array | Blob | null> {
  if (Platform.OS === 'web' || !/^(file|content):/i.test(uri)) {
    return (await fetch(uri)).blob();
  }
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return null;
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64ToBytes(b64);
}
