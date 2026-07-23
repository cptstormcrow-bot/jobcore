// Supabase client for the Jobcore mobile app.
// `react-native-url-polyfill/auto` MUST be the first import: supabase-js relies on
// the WHATWG URL API, which Hermes does not ship.
import 'react-native-url-polyfill/auto';

import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Storage adapter backing the Supabase auth session with Expo SecureStore
 * (Keychain on iOS, EncryptedSharedPreferences on Android).
 *
 * KNOWN LIMIT: SecureStore enforces a ~2048-byte ceiling per value on Android.
 * A Supabase session blob is a JSON envelope around an access JWT + refresh
 * token; a JWT carrying large custom claims (wide `app_metadata`, many roles)
 * can push the serialized session past that ceiling, at which point
 * `setItemAsync` warns and the write is lost — the user silently fails to stay
 * signed in. The known mitigation is chunking: split the value across
 * `${key}.0`, `${key}.1`, … under the limit and reassemble on read. Not
 * implemented here because the current claim set is small; implement it the
 * moment a session-persistence bug appears on Android.
 */
const secureStoreAdapter = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};

interface SupabaseExtra {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as SupabaseExtra;

const supabaseUrl = extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env (see app/.env.example), or supply ' +
      '`extra.supabaseUrl` / `extra.supabaseAnonKey` in app.json. ' +
      'EXPO_PUBLIC_* vars are inlined at build time — restart the bundler after editing .env.',
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native: there is no browser redirect
    // fragment to parse, and enabling it breaks deep links.
    detectSessionInUrl: false,
  },
});
