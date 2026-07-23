import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  | { status: 'authenticated'; session: Session; profile: Profile; organization: Organization };

const SessionContext = createContext<SessionState | null>(null);

/**
 * Resolve a raw auth session into the full authenticated state.
 * Fails closed: any missing/failed profile or organization row yields
 * `unauthenticated` rather than a partially-populated authenticated state.
 */
async function resolveSession(session: Session | null): Promise<SessionState> {
  if (!session) return { status: 'unauthenticated' };

  const profileResult = await supabase
    .from('profiles')
    .select('id, organization_id, full_name, phone, role, active, created_at')
    .eq('id', session.user.id)
    .maybeSingle<ProfileRow>();

  if (profileResult.error || !profileResult.data) return { status: 'unauthenticated' };

  let profile: Profile;
  try {
    profile = toProfile(profileResult.data);
  } catch {
    return { status: 'unauthenticated' };
  }

  if (!profile.active) return { status: 'unauthenticated' };

  const orgResult = await supabase
    .from('organizations')
    .select('id, name, slug, enabled_modules, created_at')
    .eq('id', profile.organizationId)
    .maybeSingle<OrganizationRow>();

  if (orgResult.error || !orgResult.data) return { status: 'unauthenticated' };

  return {
    status: 'authenticated',
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

  useEffect(() => {
    let cancelled = false;

    const apply = (next: SessionState) => {
      if (!cancelled) setState(next);
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => resolveSession(data.session))
      .then(apply)
      .catch(() => apply({ status: 'unauthenticated' }));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      // Re-resolve from scratch on every auth transition; the listener fires for
      // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED and USER_UPDATED alike.
      void resolveSession(session)
        .then(apply)
        .catch(() => apply({ status: 'unauthenticated' }));
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
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
