// Offline sign-in store (screens #0003 sign-in, #0072 profile).
//
// Every account that has ever signed in on this device is remembered here with a
// salted, iterated PIN hash plus a snapshot of its session/profile/organization,
// so a tech can get back in with no wifi or cell service. Everything lives in
// SecureStore (hardware-backed keystore on Android); the PIN itself is never stored.
// Until a user sets their own PIN on #0072 the PIN is the default below.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import type { Organization, Profile } from '@jobcore/core';

export const DEFAULT_PIN = '1111';
export const PIN_MIN = 4;
export const PIN_MAX = 6;

const REGISTRY_KEY = 'jobcore.offlineAccounts';
const ACTIVE_KEY = 'jobcore.offlineActive';
const SNAP_PREFIX = 'jobcore.offlineSnap.';
const CHUNK_SIZE = 1800;
const COUNT_PREFIX = '__chunks__:';
const HASH_ROUNDS = 1000;
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

export interface OfflineAccount {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  salt: string;
  hash: string;
  /** true once the user chose their own PIN (still 1111 when false) */
  custom: boolean;
  lastSignIn: string;
}

export interface OfflineSnapshot {
  session: Session;
  profile: Profile;
  organization: Organization;
}

/* ---------------------------- raw storage ---------------------------- */

async function rawGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function rawSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function rawDelete(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') window.localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // best-effort
  }
}

async function chunkedGet(key: string): Promise<string | null> {
  const head = await rawGet(key);
  if (head === null || !head.startsWith(COUNT_PREFIX)) return head;
  const n = Number(head.slice(COUNT_PREFIX.length));
  let out = '';
  for (let i = 0; i < n; i += 1) {
    const part = await rawGet(`${key}.${i}`);
    if (part === null) return null;
    out += part;
  }
  return out;
}

async function chunkedSet(key: string, value: string): Promise<void> {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) parts.push(value.slice(i, i + CHUNK_SIZE));
  for (let i = 0; i < parts.length; i += 1) await rawSet(`${key}.${i}`, parts[i] as string);
  await rawSet(key, `${COUNT_PREFIX}${parts.length}`);
}

/* ------------------------------- hashing ------------------------------ */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function newSalt(): Promise<string> {
  return toHex(await Crypto.getRandomBytesAsync(16));
}

async function hashPin(pin: string, salt: string): Promise<string> {
  let h = `${salt}:${pin}`;
  for (let i = 0; i < HASH_ROUNDS; i += 1) {
    h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${i}:${h}`);
  }
  return h;
}

export function isValidPin(pin: string): boolean {
  return /^\d+$/.test(pin) && pin.length >= PIN_MIN && pin.length <= PIN_MAX;
}

/* ------------------------------- registry ----------------------------- */

export async function listOfflineAccounts(): Promise<OfflineAccount[]> {
  const raw = await rawGet(REGISTRY_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineAccount[]) : [];
  } catch {
    return [];
  }
}

async function writeRegistry(accounts: OfflineAccount[]): Promise<void> {
  await rawSet(REGISTRY_KEY, JSON.stringify(accounts));
}

/**
 * Remember (or refresh) an account after a live sign-in. A brand-new account gets
 * the default PIN; an existing account keeps whatever PIN it already has.
 */
export async function rememberAccount(snapshot: OfflineSnapshot): Promise<void> {
  try {
    const { session, profile } = snapshot;
    const userId = session.user.id;
    const accounts = await listOfflineAccounts();
    const existing = accounts.find((a) => a.userId === userId);
    let salt = existing?.salt;
    let hash = existing?.hash;
    if (!salt || !hash) {
      salt = await newSalt();
      hash = await hashPin(DEFAULT_PIN, salt);
    }
    const next: OfflineAccount = {
      userId,
      email: session.user.email ?? existing?.email ?? '',
      fullName: profile.fullName || existing?.fullName || '',
      role: profile.role,
      salt,
      hash,
      custom: existing?.custom ?? false,
      lastSignIn: new Date().toISOString(),
    };
    await writeRegistry([next, ...accounts.filter((a) => a.userId !== userId)]);
    await chunkedSet(`${SNAP_PREFIX}${userId}`, JSON.stringify(snapshot));
    await rawSet(ACTIVE_KEY, userId);
  } catch {
    // remembering is best-effort and must never break a live sign-in
  }
}

export async function setPin(userId: string, pin: string): Promise<string | null> {
  if (!isValidPin(pin)) return `PIN must be ${PIN_MIN} to ${PIN_MAX} digits.`;
  try {
    const accounts = await listOfflineAccounts();
    const acct = accounts.find((a) => a.userId === userId);
    if (!acct) return 'This account is not saved on this device yet. Sign in once with service first.';
    const salt = await newSalt();
    const hash = await hashPin(pin, salt);
    await writeRegistry(accounts.map((a) => (a.userId === userId ? { ...a, salt, hash, custom: true } : a)));
    return null;
  } catch {
    return 'Could not save the PIN. Please try again.';
  }
}

export async function hasCustomPin(userId: string): Promise<boolean> {
  const acct = (await listOfflineAccounts()).find((a) => a.userId === userId);
  return acct?.custom === true;
}

/* ------------------------------- sign-in ------------------------------ */

const fails = new Map<string, { count: number; until: number }>();

export type PinResult =
  | { ok: true; snapshot: OfflineSnapshot }
  | { ok: false; message: string };

export async function offlineSignIn(userId: string, pin: string): Promise<PinResult> {
  const lock = fails.get(userId);
  if (lock && lock.until > Date.now()) {
    return { ok: false, message: 'Too many wrong PINs. Wait a minute and try again.' };
  }
  const acct = (await listOfflineAccounts()).find((a) => a.userId === userId);
  if (!acct) return { ok: false, message: 'This account is not saved on this device.' };
  const hash = await hashPin(pin, acct.salt);
  if (hash !== acct.hash) {
    const count = (lock?.count ?? 0) + 1;
    fails.set(userId, { count, until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    if (count >= MAX_FAILS) fails.set(userId, { count: 0, until: Date.now() + LOCK_MS });
    return { ok: false, message: 'Wrong PIN.' };
  }
  fails.delete(userId);
  const snapshot = await loadSnapshot(userId);
  if (!snapshot) return { ok: false, message: 'Saved data for this account is missing. Sign in once with service.' };
  await rawSet(ACTIVE_KEY, userId);
  return { ok: true, snapshot };
}

async function loadSnapshot(userId: string): Promise<OfflineSnapshot | null> {
  const raw = await chunkedGet(`${SNAP_PREFIX}${userId}`);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as OfflineSnapshot;
  } catch {
    return null;
  }
}

/* ------------------------- active-session marker ----------------------- */

/** The snapshot of the account that was signed in when the app last closed, if it never signed out. */
export async function loadActiveSnapshot(): Promise<OfflineSnapshot | null> {
  const userId = await rawGet(ACTIVE_KEY);
  return userId ? loadSnapshot(userId) : null;
}

/** Called on a user-initiated sign out so the next cold start asks for a sign-in. */
export async function clearActive(): Promise<void> {
  await rawDelete(ACTIVE_KEY);
}
