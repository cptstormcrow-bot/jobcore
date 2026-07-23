import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Organization, Profile, Role } from '@jobcore/core';

import { supabase } from './supabase';

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
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'authenticated'; session: Session; profile: Profile; organization: Organization };

const SessionContext = createContext<SessionState | null>(null);

/**
 * Outcome of a single resolve attempt. Deliberately distinct from
 * `SessionState`: a `failed` outcome does not by itself mean the UI should
 * show the error screen — the provider decides that by weighing it against
 * whatever state came before (see `applyOutcome` below).
 */
type ResolveOutcome =
  | { kind: 'unauthenticated' }
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
    .select('id, organization_id, full_name, phone, role, active, created_at')
    .eq('id', session.user.id)
    .maybeSingle<ProfileRow>();

  if (profileResult.error) return { kind: 'failed', message: profileResult.error.message };
  if (!profileResult.data) return { kind: 'unauthenticated' };

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

export interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const cancelledRef = useRef(false);

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

    function runCheck() {
      void supabase.auth
        .getSession()
        .then(({ data }) => resolveSession(data.session))
        .then(applyOutcome)
        .catch((err) => applyOutcome(toFailure(err)));
    }

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

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
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
 */
export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return error ? error.message : null;
}

/** Sign out. Returns an error message on failure, `null` on success. */
export async function signOut(): Promise<string | null> {
  const { error } = await supabase.auth.signOut();
  return error ? error.message : null;
}
