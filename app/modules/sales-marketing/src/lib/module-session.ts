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

let current: ModuleSession | null = null;

/**
 * Injection point for the host. Pass an already-narrowed `ModuleSession`
 * once the host has resolved its own session, or `null` to clear it
 * (e.g. on sign-out). This is the ONLY function that may write `current`.
 */
export function setModuleSession(session: ModuleSession | null): void {
  current = session;
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
  current = null;
}
