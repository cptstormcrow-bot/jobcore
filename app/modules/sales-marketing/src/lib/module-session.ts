/**
 * Session seam for the sales-marketing module (P6).
 *
 * This module MUST NOT import `apps/mobile` — doing so would create a
 * dependency cycle (forbidden by the module-isolation contract), so the
 * host's session cannot be read directly from
 * `apps/mobile/src/lib/session.tsx`.
 *
 * The host's session value is a discriminated union, and narrowing that
 * union inside this module (an `=== 'authenticated'` style check) would
 * defeat the AC-4 dependency-safety scan run against this module's tree.
 * So this module never receives the union at all: it only ever holds an
 * ALREADY-NARROWED `ModuleSession`, handed to it via injection.
 *
 * `setModuleSession` is the injection point — the ONLY writer. Until a
 * host calls it, `getModuleSession` returns `null` and screens render
 * their empty state rather than narrowing anything themselves. This keeps
 * the dependency edge strictly one-way (host -> module, never the
 * reverse) and this module group fully ungated in the meantime.
 *
 * This is a structurally independent copy of field-tech's
 * `module-session.ts` — module isolation forbids sales-marketing from
 * importing or reusing field-tech's (or admin-finance's) singleton.
 */

export interface ModuleSession {
  org: Organization;
  role: Role;
  userId: string;
}

import type { Organization, Role } from '@jobcore/core';
import { useSyncExternalStore } from 'react';

let current: ModuleSession | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/**
 * Subscribes to changes in the injected session. Returns an unsubscribe
 * function. Intended for use via `useModuleSession` below; exposed
 * directly for any non-hook consumer that needs it.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Structural equality check for `ModuleSession` — gates `notify()` in
 * `setModuleSession` so re-injecting an unchanged session doesn't trigger
 * a re-render.
 */
function sessionsEqual(a: ModuleSession | null, b: ModuleSession | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.org.id === b.org.id && a.role === b.role && a.userId === b.userId;
}

/**
 * Injection point for the host. Pass an already-narrowed `ModuleSession`
 * once the host has resolved its own session, or `null` to clear it
 * (e.g. on sign-out). This is the ONLY function that may write `current`.
 */
export function setModuleSession(session: ModuleSession | null): void {
  const changed = !sessionsEqual(current, session);
  current = session;
  if (changed) {
    notify();
  }
}

/**
 * Returns the pre-narrowed session, or `null` if the host has not yet
 * injected one (or the user is not signed in). Callers render their
 * empty/loading state on `null` — they never narrow a union here, because
 * none is ever exposed to this module.
 */
export function getModuleSession(): ModuleSession | null {
  return current;
}

/** Convenience wrapper — equivalent to `setModuleSession(null)`. */
export function clearModuleSession(): void {
  setModuleSession(null);
}

/**
 * Reactive companion to `getModuleSession()`. Plain module-level state isn't
 * part of React's reactivity system, so a component that calls
 * `getModuleSession()` during render can render before the host (see
 * `app/m/[moduleId].tsx`, which injects during its own render) calls `setModuleSession()`, and
 * then never re-render even after the session becomes available. This hook
 * subscribes the calling component to the store so it re-renders whenever
 * `setModuleSession`/`clearModuleSession` fire.
 */
export function useModuleSession(): ModuleSession | null {
  return useSyncExternalStore(subscribe, getModuleSession);
}
