import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import type { Organization, Profile, Role } from '@jobcore/core';

import NetInfo from '@react-native-community/netinfo';

import { supabase } from './supabase';
import { AppState } from 'react-native';
import { rememberAccount, listOfflineAccounts, clearActive, loadActiveSnapshot, type OfflineSnapshot } from './offline-auth';
import { writeThrough } from './offline-mutations';
import { cachedRead } from './read-cache';
import { getCached, wipeAll } from './read-cache-store';
import { discardAllFailed, setSessionRecoverer } from './offline-db';
import { reportDeviceStatus } from './device-status-report';
import { isVehicleStatus, isToolStatus } from '../../../../modules/admin-finance/src/data/ports';

/* ------------------------------------------------------------------ *
 * DB row shapes (snake_case) → domain types (camelCase)
 * ------------------------------------------------------------------ */

export interface ProfileRow {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string | null;
  role: string;
  active: boolean;
  created_at: string;
  is_test: boolean;
  address: string | null;
  drivers_license_number: string | null;
  vehicle_status: string | null;
  tool_status: string | null;
  paid_travel: boolean;
  paid_travel_policy_message: string | null;
  email?: string | null;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  enabled_modules: string[] | null;
  created_at: string;
}

const ROLES: readonly Role[] = ['owner', 'admin', 'tech', 'sales'];

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * Map a `profiles` row to the domain `Profile`.
 * Throws on an unrecognized role rather than widening the union — an unknown
 * role must fail closed, never degrade into an unchecked permission.
 */
export function toProfile(row: ProfileRow): Profile {
  if (!isRole(row.role)) {
    throw new Error(`Unknown role "${row.role}" on profile ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    isTest: row.is_test,
    address: row.address,
    driversLicenseNumber: row.drivers_license_number,
    vehicleStatus: row.vehicle_status && isVehicleStatus(row.vehicle_status) ? row.vehicle_status : null,
    toolStatus: row.tool_status && isToolStatus(row.tool_status) ? row.tool_status : null,
    paidTravel: row.paid_travel,
    paidTravelPolicyMessage: row.paid_travel_policy_message,
    email: row.email ?? null,
  };
}

/** Map an `organizations` row to the domain `Organization`. */
export function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    enabledModules: row.enabled_modules ?? [],
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ *
 * Session state
 * ------------------------------------------------------------------ */

export type SessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'disabled'; profile: Profile }
  | { status: 'unprovisioned'; session: Session }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'authenticated'; session: Session; profile: Profile; organization: Organization; fromCache?: boolean };

// The context/hook value is `SessionState` plus a `recheck()` callable — kept
// as a separate type (rather than folded into `SessionState` itself) so the
// state machine's variants stay the single source of truth for `status`.
export type SessionValue = SessionState & { recheck: () => Promise<void> };

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Outcome of a single resolve attempt. Deliberately distinct from
 * `SessionState`: a `failed` outcome does not by itself mean the UI should
 * show the error screen — the provider decides that by weighing it against
 * whatever state came before (see `applyOutcome` below).
 */
type ResolveOutcome =
  | { kind: 'unauthenticated' }
  | { kind: 'unprovisioned'; session: Session }
  | { kind: 'disabled'; profile: Profile }
  | { kind: 'failed'; message: string }
  | { kind: 'authenticated'; session: Session; profile: Profile; organization: Organization; fromCache?: boolean };

/**
 * Resolve a raw auth session into a `ResolveOutcome`.
 *
 * A `null` session (no local session at all) and a profile row that simply
 * doesn't exist both resolve to `unauthenticated` — those are definitive,
 * not transient. Anything that looks like a request failure (query error,
 * unrecognized role, missing org row behind an otherwise-valid profile)
 * resolves to `failed` instead, so the caller can distinguish "this account
 * doesn't exist" from "we couldn't tell right now."
 */
async function resolveSession(session: Session | null): Promise<ResolveOutcome> {
  if (!session) return { kind: 'unauthenticated' };

  const userId = session.user.id;
  const profileRead = await readRowCached<ProfileRow>(`session.profile:${userId}`, async () =>
    supabase
      .from('profiles')
      .select('id, organization_id, full_name, phone, role, active, created_at, is_test, address, drivers_license_number, vehicle_status, tool_status, paid_travel, paid_travel_policy_message, email')
      .eq('id', userId)
      .maybeSingle<ProfileRow>(),
  );
  if ('error' in profileRead) return { kind: 'failed', message: profileRead.error };
  // An auth user with no matching `profiles` row is a provisioning gap, not a
  // signed-out user; collapsing it into `unauthenticated` created an invisible
  // sign-in -> redirect -> sign-in loop with no error message and no way out.
  if (!profileRead.data) return { kind: 'unprovisioned', session };

  let profile: Profile;
  try {
    profile = toProfile(profileRead.data);
  } catch (err) {
    return { kind: 'failed', message: err instanceof Error ? err.message : 'Unrecognized account role.' };
  }

  // `disabled` only ever comes from a live answer; a cached "inactive" row is not trusted.
  if (!profile.active) {
    if (profileRead.fromCache) return { kind: 'failed', message: 'Could not confirm your account status. Check your connection and retry.' };
    return { kind: 'disabled', profile };
  }

  const orgRead = await readRowCached<OrganizationRow>(`session.org:${profile.organizationId}`, async () =>
    supabase
      .from('organizations')
      .select('id, name, slug, enabled_modules, created_at')
      .eq('id', profile.organizationId)
      .maybeSingle<OrganizationRow>(),
  );
  if ('error' in orgRead) return { kind: 'failed', message: orgRead.error };
  if (!orgRead.data) return { kind: 'failed', message: 'Organization record not found.' };

  const fromCache = profileRead.fromCache || orgRead.fromCache;
  return {
    kind: 'authenticated',
    session,
    profile,
    organization: toOrganization(orgRead.data),
    ...(fromCache ? { fromCache: true } : {}),
  };
}

/**
 * Read one row through the read cache under an 8 s timeout. Query errors and
 * timeouts fall back to a cached row when one exists (fromCache: true); a live
 * "no row" answer (data null) is returned as-is and never cached. profile_private
 * is never read here.
 */
async function readRowCached<T>(
  key: string,
  query: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<{ data: T | null; fromCache: boolean } | { error: string }> {
  try {
    const r = await withTimeout(
      cachedRead<T | null>(key, async () => {
        const res = await query();
        if (res.error) throw new Error(res.error.message);
        return res.data;
      }),
      8000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    return { data: r.data, fromCache: r.fromCache };
  } catch (err) {
    try {
      const c = await getCached(key);
      if (c) return { data: JSON.parse(c.payload) as T, fromCache: true };
    } catch {
      // no usable cache; fall through to the original error
    }
    return { error: err instanceof Error ? err.message : 'Unable to reach the server.' };
  }
}

/**
 * Wraps a promise with a timeout so a hung native call (observed: SecureStore /
 * getSession() occasionally never resolving on some devices) degrades to the
 * existing 'error' state instead of leaving the UI on an infinite spinner.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface SessionProviderProps {
  children: React.ReactNode;
}

// Offline sign-in plumbing. `signOutIntent` is true only while the user's own sign-out is
// running, so a SIGNED_OUT event with no service can be told apart from a real sign-out.
// `bridge` lets the module-level helpers below reach the mounted provider.
let signOutIntent = false;
// Set when a launch with no service is sent to the PIN screen; sign-in opens its PIN panel once.
let offlineLaunch = false;

/** True once after a launch with no service was routed to the PIN sign-in on #0003. */
export function consumeOfflineLaunch(): boolean {
  const v = offlineLaunch;
  offlineLaunch = false;
  return v;
}
let bridge: { enter: (s: OfflineSnapshot) => void; signedOut: () => void } | null = null;

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const stateRef = useRef<SessionState>(state);
  stateRef.current = state;
  // Set while the app is running from a saved snapshot instead of a live Supabase session.
  const offlineSnapRef = useRef<OfflineSnapshot | null>(null);
  const cancelledRef = useRef(false);
  // Holds the effect-scoped `runCheck` so it stays callable from outside the
  // effect (as `recheck`) without re-running the auth-listener setup below.
  const recheckRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    cancelledRef.current = false;

    // Cold-start failure (no session established yet) shows the error screen.
    // Warm failure (we already have a good authenticated session) is swallowed —
    // the last-known-good state is retained and the next successful check
    // reconciles it silently. Only `authenticated` counts as "last-good";
    // `disabled` and `unauthenticated` are definitive, not something to fall
    // back to.
    const applyOutcome = (outcome: ResolveOutcome) => {
      if (cancelledRef.current) return;
      if (outcome.kind === 'authenticated' && !outcome.fromCache) {
        // A live, confirmed sign-in: leave offline mode and remember this account for later.
        offlineSnapRef.current = null;
        void rememberAccount({ session: outcome.session, profile: outcome.profile, organization: outcome.organization });
      }
      setState((prev) => {
        if (outcome.kind === 'failed') {
          if (prev.status === 'authenticated') return prev;
          return { status: 'error', message: outcome.message, retry: runCheck };
        }
        if (outcome.kind === 'unauthenticated') return { status: 'unauthenticated' };
        if (outcome.kind === 'unprovisioned') return { status: 'unprovisioned', session: outcome.session };
        if (outcome.kind === 'disabled') return { status: 'disabled', profile: outcome.profile };
        return {
          status: 'authenticated',
          session: outcome.session,
          profile: outcome.profile,
          organization: outcome.organization,
          ...(outcome.fromCache ? { fromCache: true } : {}),
        };
      });
    };

    const toFailure = (err: unknown): ResolveOutcome => ({
      kind: 'failed',
      message: err instanceof Error ? err.message : 'Unable to reach the server.',
    });

    // Run from the saved snapshot of the account that was last signed in (never signed out).
    const enterFromSnapshot = (snap: OfflineSnapshot) => {
      if (cancelledRef.current || stateRef.current.status === 'authenticated') return;
      offlineSnapRef.current = snap;
      setState({
        status: 'authenticated',
        session: snap.session,
        profile: snap.profile,
        organization: snap.organization,
        fromCache: true,
      });
      // Signed in with the PIN but the service is reachable (or only half reachable): go live right
      // away instead of waiting for a connectivity change. Harmless when truly offline (it just fails).
      void recoverOnline();
    };

    // Cold start that cannot reach the server: if any account is remembered on this device,
    // send the user to sign-in #0003 to enter their PIN instead of the error screen.
    const settled = () => cancelledRef.current || stateRef.current.status === 'authenticated';
    const routeToPin = async (): Promise<boolean> => {
      if (settled()) return false;
      try {
        if ((await listOfflineAccounts()).length === 0) return false;
      } catch {
        return false;
      }
      if (settled()) return false;
      offlineLaunch = true;
      setState({ status: 'unauthenticated' });
      return true;
    };

    // Applies an outcome, but a cold-start failure with remembered accounts goes to the PIN.
    const applyOrPin = async (outcome: ResolveOutcome) => {
      if (outcome.kind === 'failed' && (await routeToPin())) return;
      applyOutcome(outcome);
    };

    function runCheck(): Promise<void> {
      return withTimeout(
        supabase.auth.getSession(),
        15000,
        'Timed out reaching the server. Check your connection and retry.',
      )
        .then(async ({ data, error }) => {
          // Cold start with no service and an expired token: auth-js reports no session plus an
          // error. That is not a sign-out, so fall back to the remembered account.
          if (!data.session && error && (await routeToPin())) return;
          await applyOrPin(await resolveSession(data.session));
        })
        .catch(async (err) => {
          await applyOrPin(toFailure(err));
        });
    }

    recheckRef.current = runCheck;
    runCheck();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Re-resolve from scratch on every auth transition; the listener fires for
      // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED and USER_UPDATED alike.
      void (async () => {
        if (!session) {
          // While running from a saved snapshot there is no live session to lose.
          if (offlineSnapRef.current) return;
          if (event === 'INITIAL_SESSION') return; // runCheck owns the cold-start decision
          if (event === 'SIGNED_OUT' && !signOutIntent) {
            // A failed refresh with no service must never sign the user out.
            const net = await NetInfo.fetch().catch(() => null);
            if (net && net.isConnected === false) return;
          }
        }
        await applyOrPin(await resolveSession(session));
      })().catch((err) => applyOrPin(toFailure(err)));
    });

    // Back online while running from a snapshot: re-establish the live session in the background.
    // Restore the live Supabase session from the remembered account (snapshot tokens). Used when
    // back online, when the app returns to the foreground, and by the offline drain when it finds
    // no session (so a phone never needs a manual re-sign-in). Returns true when a session exists.
    let recovering: Promise<boolean> | null = null;
    const recoverOnline = (): Promise<boolean> => {
      if (recovering) return recovering;
      recovering = (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            if (offlineSnapRef.current) {
              offlineSnapRef.current = null;
              await runCheck();
            }
            return true;
          }
          // Prefer the in-memory snapshot; fall back to the saved active-account snapshot so a
          // lost/torn SecureStore session while "signed in" is healed too.
          const snap = offlineSnapRef.current ?? (await loadActiveSnapshot());
          if (!snap || cancelledRef.current) return false;
          const { error } = await supabase.auth.setSession({
            access_token: snap.session.access_token,
            refresh_token: snap.session.refresh_token,
          });
          // On success SIGNED_IN drives a live resolve. On failure stay as-is; the PIN path still works.
          if (error) return false;
          offlineSnapRef.current = null;
          return true;
        } catch {
          return false; // still offline or token revoked: keep running from the snapshot
        }
      })().finally(() => {
        recovering = null;
      });
      return recovering;
    };
    const unsubscribeNet = NetInfo.addEventListener((net) => {
      if (net.isConnected && offlineSnapRef.current) void recoverOnline();
    });
    // Coming back to the app is the moment a stale session shows up: heal it right then.
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void (async () => {
        const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        if (!data.session && stateRef.current.status === 'authenticated') await recoverOnline();
      })();
    });
    setSessionRecoverer(recoverOnline);

    bridge = {
      enter: enterFromSnapshot,
      signedOut: () => {
        offlineSnapRef.current = null;
        if (!cancelledRef.current) setState({ status: 'unauthenticated' });
      },
    };

    return () => {
      cancelledRef.current = true;
      bridge = null;
      setSessionRecoverer(null);
      appStateSub.remove();
      unsubscribeNet();
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Re-runs the profile query for the current auth user and updates status;
  // exposed so callers (e.g. the unprovisioned-account overlay's "Check
  // again") can retry without a full remount.
  const recheck = useCallback((): Promise<void> => recheckRef.current(), []);

  return (
    <SessionContext.Provider value={{ ...state, recheck }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error('useSession() must be called inside a <SessionProvider>.');
  }
  return ctx;
}

/* ------------------------------------------------------------------ *
 * Auth helpers
 * ------------------------------------------------------------------ */

/**
 * Sign in with email + password. Returns an error message on failure and
 * `null` on success; the provider's auth listener drives the state change.
 *
 * Wrapped in withTimeout() for the same reason as getSession() in runCheck():
 * signInWithPassword() persists the new session via the SecureStore chunking
 * adapter (see supabase.ts), and a hung native SecureStore call would
 * otherwise leave the UI stuck on "Signing in..." forever with no error path.
 */
export async function signIn(email: string, password: string): Promise<string | null> {
  try {
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      }),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    return error ? error.message : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
    return message;
  }
}

/**
 * Send a password-reset email. Returns an error message on failure and `null`
 * on success. Same withTimeout() guard as signIn() above.
 */
export async function resetPassword(email: string): Promise<string | null> {
  try {
    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('/reset-password'),
      }),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    return error ? error.message : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not send the reset email. Please try again.';
    return message;
  }
}

/**
 * Sign up with email + password. Returns an error message on failure and
 * `null` on success; the provider's auth listener drives the state change.
 *
 * Wrapped in withTimeout() for the same reason as signIn() above: signUp()
 * persists the new session via the SecureStore chunking adapter (see
 * supabase.ts), and a hung native SecureStore call would otherwise leave the
 * UI stuck on "Signing up..." forever with no error path.
 */
export async function signUp(email: string, password: string): Promise<string | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email: email.trim(),
        password,
      }),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    if (error) return error.message;
    // No session back means the server wants the email confirmed (or the account was just made and must sign in).
    return data.session ? null : SIGN_UP_NEEDS_SIGN_IN;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
    return message;
  }
}

/** signUp() result when the account exists but no session started yet (not an error). */
export const SIGN_UP_NEEDS_SIGN_IN = 'SIGN_UP_NEEDS_SIGN_IN';

/** True when a sign-in error is Supabase's "email not confirmed" block. */
export function isEmailNotConfirmed(message: string): boolean {
  return /email not confirmed/i.test(message);
}

/** Re-send the sign-up confirmation email. Returns an error message, or `null` on success. */
export async function resendConfirmation(email: string): Promise<string | null> {
  try {
    const { error } = await withTimeout(
      supabase.auth.resend({ type: 'signup', email: email.trim() }),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    return error ? error.message : null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not send the email. Please try again.';
  }
}

/** Sign out. Returns an error message on failure, `null` on success. */
export async function signOut(): Promise<string | null> {
  signOutIntent = true;
  try {
    // Report the final sync state while still signed in, then drop this login's failed saves.
    await reportDeviceStatus(true, true).catch(() => {});
    await discardAllFailed().catch(() => {});
    // A global sign-out needs the network; with no service it fails WITHOUT clearing the
    // local session. Fall back to a local-scope sign-out so signing out always works.
    try {
      const { error } = await withTimeout(supabase.auth.signOut(), 4000, 'sign-out timed out');
      if (error) await supabase.auth.signOut({ scope: 'local' });
    } catch {
      await supabase.auth.signOut({ scope: 'local' });
    }
    await clearActive();
    // Saved data is cleared only on the user's own sign-out, never on a launch with no service.
    await wipeAll().catch(() => {});
    bridge?.signedOut();
    return null;
  } finally {
    signOutIntent = false;
  }
}

/** Enter the app from a PIN-verified offline snapshot (screen #0003 offline sign-in). */
export function enterOfflineSession(snapshot: OfflineSnapshot): void {
  bridge?.enter(snapshot);
}

/**
 * Change the signed-in user's password. Returns an error message on failure
 * and `null` on success.
 *
 * Wrapped in withTimeout() for the same reason as signIn() above: updateUser()
 * persists the refreshed session via the SecureStore chunking adapter (see
 * supabase.ts), and a hung native SecureStore call would otherwise leave the
 * UI stuck with no error path.
 */
export async function updatePassword(newPassword: string): Promise<string | null> {
  try {
    const { error } = await withTimeout(
      supabase.auth.updateUser({ password: newPassword }),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    return error ? error.message : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Password change failed. Please try again.';
    return message;
  }
}

/**
 * Update the signed-in user's display name on their profiles row. Returns an
 * error message on failure and `null` on success. The caller trims/validates.
 *
 * An RLS-filtered UPDATE affects 0 rows without raising an error, so an empty
 * result is treated as failure. Wrapped in withTimeout() like signIn() above.
 */
export async function updateFullName(userId: string, fullName: string): Promise<string | null> {
  try {
    const res = await withTimeout(
      writeThrough(
        'profile.update_name',
        { userId, fullName },
        new Date().toISOString(),
        { id: userId, fullName },
      ),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    void res;
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save your name. Please try again.';
    return message;
  }
}

/**
 * Change the signed-in user's email. Returns an error message on failure and
 * `null` on success. Supabase sends a confirmation email, and the address does
 * not change until it is confirmed.
 *
 * Wrapped in withTimeout() for the same reason as updatePassword() above.
 */
export async function updateEmail(email: string): Promise<string | null> {
  try {
    const { error } = await withTimeout(
      supabase.auth.updateUser({ email }),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    return error ? error.message : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update your email. Please try again.';
    return message;
  }
}
