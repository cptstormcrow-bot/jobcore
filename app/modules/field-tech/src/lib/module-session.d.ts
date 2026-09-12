/**
 * Session seam for the field-tech module (P4.S1.2).
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
 * This is a structurally independent copy of admin-finance's
 * `module-session.ts` — module isolation forbids field-tech from
 * importing or reusing admin-finance's singleton.
 */
export interface ModuleSession {
    org: Organization;
    role: Role;
    userId: string;
}
import type { Organization, Role } from '@jobcore/core';
/**
 * Injection point for the host. Pass an already-narrowed `ModuleSession`
 * once the host has resolved its own session, or `null` to clear it
 * (e.g. on sign-out). This is the ONLY function that may write `current`.
 */
export declare function setModuleSession(session: ModuleSession | null): void;
/**
 * Returns the pre-narrowed session, or `null` if the host has not yet
 * injected one (or the user is not signed in). Callers render their
 * empty/loading state on `null` — they never narrow a union here, because
 * none is ever exposed to this module.
 */
export declare function getModuleSession(): ModuleSession | null;
/** Convenience wrapper — equivalent to `setModuleSession(null)`. */
export declare function clearModuleSession(): void;
/**
 * Reactive companion to `getModuleSession()`. Plain module-level state isn't
 * part of React's reactivity system, so a component that calls
 * `getModuleSession()` during render can render once before the host's
 * `useEffect` (see `app/m/[moduleId].tsx`) calls `setModuleSession()`, and
 * then never re-render even after the session becomes available. This hook
 * subscribes the calling component to the store so it re-renders whenever
 * `setModuleSession`/`clearModuleSession` fire.
 */
export declare function useModuleSession(): ModuleSession | null;
//# sourceMappingURL=module-session.d.ts.map