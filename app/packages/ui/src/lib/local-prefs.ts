// Small, generic durable boolean-preference storage for the mobile app.
// Native implementation — backed directly by Expo SecureStore (Keychain on
// iOS, EncryptedSharedPreferences on Android). Unlike the Supabase session
// adapter in supabase.ts, values stored here are tiny (a single "true"/
// "false" string) and well under SecureStore's ~2048-byte ceiling, so no
// chunking is needed.
//
// Metro resolves this file on native and local-prefs.web.ts on web via the
// `.web.ts` filename suffix — same platform-split pattern as offline-db.ts /
// offline-db.web.ts.
import * as SecureStore from 'expo-secure-store';

/** Reads a stored boolean preference, falling back to `defaultValue` if unset. */
export async function getBoolPref(key: string, defaultValue: boolean): Promise<boolean> {
  const value = await SecureStore.getItemAsync(key);
  if (value === null) return defaultValue;
  return value === 'true';
}

/** Persists a boolean preference. Survives app restarts and logout/login. */
export async function setBoolPref(key: string, value: boolean): Promise<void> {
  await SecureStore.setItemAsync(key, value ? 'true' : 'false');
}
