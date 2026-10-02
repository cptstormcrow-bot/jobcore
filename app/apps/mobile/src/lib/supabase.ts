// Supabase client for the Jobcore mobile app.
// `react-native-url-polyfill/auto` MUST be the first import: supabase-js relies on
// the WHATWG URL API, which Hermes does not ship.
import 'react-native-url-polyfill/auto';

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Storage adapter backing the Supabase auth session with Expo SecureStore
 * (Keychain on iOS, EncryptedSharedPreferences on Android).
 *
 * SecureStore enforces a ~2048-byte ceiling per value on Android. A Supabase
 * session blob is a JSON envelope around an access JWT + refresh token; a JWT
 * carrying large custom claims (wide `app_metadata`, many roles) can push the
 * serialized session past that ceiling, at which point `setItemAsync` warns and
 * the write is lost — the user silently fails to stay signed in.
 *
 * Mitigation implemented here is CHUNKING, not encryption-to-AsyncStorage:
 * the value is split across `${key}.0 … ${key}.N-1` and `key` itself holds a
 * chunk-count record. Everything stays inside the Keychain/EncryptedSharedPrefs
 * trust boundary and no crypto dependency is added.
 *
 * `getItem` tolerates a plain (pre-chunking) value written by the old adapter,
 * so an app upgrade does not sign existing users out.
 */

// Chosen below the ~2048 ceiling with headroom: the platform limit applies to
// the encrypted payload, which is larger than the plaintext we measure here.
const CHUNK_SIZE = 1800;
const COUNT_PREFIX = '__chunks__:';

const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;
    if (!head.startsWith(COUNT_PREFIX)) return head; // legacy unchunked value

    const count = Number(head.slice(COUNT_PREFIX.length));
    if (!Number.isInteger(count) || count < 1) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    // A missing chunk means a torn write: treat the whole value as absent
    // rather than handing supabase-js a truncated session it would half-trust.
    if (parts.some((p) => p === null)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear any prior chunks first so a shrinking value cannot leave stale
    // tail chunks that a later, longer write would silently reuse.
    await secureStoreAdapter.removeItem(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk)),
    );
    // Count record written LAST: until it lands, getItem sees no key and
    // reports "signed out" rather than reading a partially-written set.
    await SecureStore.setItemAsync(key, `${COUNT_PREFIX}${chunks.length}`);
  },

  async removeItem(key: string): Promise<void> {
    const head = await SecureStore.getItemAsync(key);
    if (head !== null && head.startsWith(COUNT_PREFIX)) {
      const count = Number(head.slice(COUNT_PREFIX.length));
      if (Number.isInteger(count) && count > 0) {
        await Promise.all(
          Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
        );
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface SupabaseExtra {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as SupabaseExtra;

export const supabaseUrl = extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env (see apps/mobile/.env.example), or supply ' +
      '`extra.supabaseUrl` / `extra.supabaseAnonKey` in app.json. ' +
      'EXPO_PUBLIC_* vars are inlined at bundle time from apps/mobile/.env — restart the bundler after editing .env. ' +
      'For the release APK, run `npm run build:apk` (gradlew assembleRelease) in the main checkout where .env exists; ' +
      'without it the APK ships with no Supabase config (the build preflight blocks this).',
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native: there is no browser redirect
    // fragment to parse, and enabling it breaks deep links.
    detectSessionInUrl: false,
  },
});
