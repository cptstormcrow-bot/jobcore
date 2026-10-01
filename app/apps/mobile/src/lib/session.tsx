import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Organization, Profile, Role } from '@jobcore/core';

import { supabase } from './supabase';
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
  | { status: 'authenticated'; session: Session; profile: Profile; organization: Organization };

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
  | { kind: 'authenticated'; session: Session; profile: Profile; organization: Organization };

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

  const profileResult = await supabase
    .from('profiles')
    .select('id, organization_id, full_name, phone, role, active, created_at, is_test, address, drivers_license_number, vehicle_status, tool_status, paid_travel, paid_travel_policy_message')
    .eq('id', session.user.id)
    .maybeSingle<ProfileRow>();

  if (profileResult.error) return { kind: 'failed', message: profileResult.error.message };
  // An auth user with no matching `profiles` row is a provisioning gap, not a
  // signed-out user; collapsing it into `unauthenticated` created an invisible
  // sign-in -> redirect -> sign-in loop with no error message and no way out.
  if (!profileResult.data) return { kind: 'unprovisioned', session };

  let profile: Profile;
  try {
    profile = toProfile(profileResult.data);
  } catch (err) {
    return { kind: 'failed', message: err instanceof Error ? err.message : 'Unrecognized account role.' };
  }

  if (!profile.active) return { kind: 'disabled', profile };

  const orgResult = await supabase
    .from('organizations')
    .select('id, name, slug, enabled_modules, created_at')
    .eq('id', profile.organizationId)
    .maybeSingle<OrganizationRow>();

  if (orgResult.error) return { kind: 'failed', message: orgResult.error.message };
  if (!orgResult.data) return { kind: 'failed', message: 'Organization record not found.' };

  return {
    kind: 'authenticated',
    session,
    profile,
    organization: toOrganization(orgResult.data),
  };
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

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
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
        };
      });
    };

    const toFailure = (err: unknown): ResolveOutcome => ({
      kind: 'failed',
      message: err instanceof Error ? err.message : 'Unable to reach the server.',
    });

    function runCheck(): Promise<void> {
      return withTimeout(
        supabase.auth.getSession(),
        15000,
        'Timed out reaching the server. Check your connection and retry.',
      )
        .then(({ data }) => {
          return resolveSession(data.session);
        })
        .then((outcome) => {
          applyOutcome(outcome);
        })
        .catch((err) => {
          applyOutcome(toFailure(err));
        });
    }

    recheckRef.current = runCheck;
    runCheck();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      // Re-resolve from scratch on every auth transition; the listener fires for
      // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED and USER_UPDATED alike.
      void resolveSession(session)
        .then(applyOutcome)
        .catch((err) => applyOutcome(toFailure(err)));
    });

    return () => {
      cancelledRef.current = true;
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
    const { error } = await withTimeout(
      supabase.auth.signUp({
        email: email.trim(),
        password,
      }),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    return error ? error.message : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
    return message;
  }
}

/** Sign out. Returns an error message on failure, `null` on success. */
export async function signOut(): Promise<string | null> {
  const { error } = await supabase.auth.signOut();
  return error ? error.message : null;
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
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.from('profiles').update({ full_name: fullName }).eq('id', userId).select('id')),
      15000,
      'Timed out reaching the server. Check your connection and retry.',
    );
    if (error) return error.message;
    if (!data || data.length === 0) return 'Could not save your name. Please try again.';
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
