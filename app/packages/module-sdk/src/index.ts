/*
 * Jobcore module contract + compile-time registry.
 *
 * WHY there is no runtime module loading (per MASTER-SPEC §3):
 * React Native cannot load or execute new native code at runtime, and App Store /
 * Play Store review forbid downloading + running new code post-install. "Pluggable"
 * here therefore means COMPILE-TIME registration + RUNTIME toggle: a module is a
 * workspace package compiled into the app and added to this registry, then enabled or
 * disabled per organization via `organizations.enabled_modules`. In short:
 * adding a module is a build; enabling one is a config change.
 */

import type { ComponentType } from 'react';
import type { Job, Organization, Role } from '@jobcore/core';

// --- Supporting types -------------------------------------------------------
// §11 references these without full definitions; minimal correct shapes below.

/**
 * A screen a module contributes to the navigator.
 *
 * `component` is the real React component, not a string name: React Native has no
 * runtime string→component resolver and Expo Router's `typedRoutes` cannot mint route
 * files for dynamically-registered paths. Nav is therefore "static file + dynamic
 * segment" — one real route file `app/m/[moduleId].tsx` resolves the module from the
 * registry and renders this component directly.
 */
export interface ModuleRoute {
  path: string;
  component: ComponentType;
}

/** A navigation entry: icon, label, and sort order (§11: "icon, label, sort order"). */
export interface NavEntry {
  icon: string;
  label: string;
  order: number;
}

/** A button injected into the shared Job Detail screen. */
export interface JobAction {
  id: string;
  label: string;
  /** Optional gate: if present, the action is hidden from the shared Job Detail unless this
   * returns true for the current job. Evaluated synchronously against Job fields only (no
   * async estimate/port lookups). */
  visibleWhen?(job: Job): boolean;
  /** Optional invoke-time side effect hook: runs a module's custom logic when this action fires (distinct from any navigation/routing the action may already declare). */
  onInvoke?(job: Job): void | Promise<void>;
}

/** Module-owned settings contract (minimal shape — §11 leaves it unspecified). */
export interface SettingsSchema {
  fields: Record<string, unknown>;
}

/** Emitted when a job's status changes. */
export interface JobStatusEvent {
  jobId: string;
  status: string;
}

/** Emitted when a job is completed. */
export interface JobCompletedEvent {
  jobId: string;
  completedAt: string;
}

// --- §11 module contract (verbatim) -----------------------------------------

export interface JobcoreModule {
  id: string; // 'admin-finance'
  displayName: string;
  requiredRoles: Role[]; // gates visibility AND is mirrored in RLS
  routes: ModuleRoute[]; // screens contributed to the navigator
  navEntries: NavEntry[]; // icon, label, sort order
  /**
   * When true, the module stays registered, role-gated and routable at /m/<id>,
   * but is left out of the logo module switcher (moduleSwitcherItems). For a
   * module reached from inside another module, where a switcher entry would
   * duplicate it.
   */
  hideFromSwitcher?: boolean;
  jobActions?: JobAction[]; // buttons injected into the shared Job Detail screen
  hooks?: {
    onJobStatusChange?(e: JobStatusEvent): Promise<void>;
    onJobCompleted?(e: JobCompletedEvent): Promise<void>;
  };
  migrations?: string[]; // module-owned Supabase tables
  settings?: SettingsSchema;
}

// --- Compile-time registry --------------------------------------------------

const registry = new Map<string, JobcoreModule>();

/**
 * Register a module at compile time.
 * Re-registering the identical module object is a no-op: Fast Refresh/HMR
 * re-evaluates modules.ts while this Map survives. A different module reusing
 * an id is still a build-time bug and throws.
 */
export function registerModule(m: JobcoreModule): void {
  if (registry.get(m.id) === m) {
    return;
  }
  if (registry.has(m.id)) {
    throw new Error(`Duplicate module registration: a module with id "${m.id}" is already registered.`);
  }
  registry.set(m.id, m);
}

/**
 * The modules visible to `role` within `org`.
 * A module is included iff BOTH:
 *   (1) org.enabledModules.includes(module.id), AND
 *   (2) module.requiredRoles.includes(role).
 * Sorted by each module's lowest NavEntry.order (a module with no nav entries sorts last).
 */
export function getEnabledModules(org: Organization, role: Role): JobcoreModule[] {
  const enabled: JobcoreModule[] = [];
  for (const module of registry.values()) {
    if (!org.enabledModules.includes(module.id)) {
      continue;
    }
    // fail-closed: empty requiredRoles => visible to no role
    if (!module.requiredRoles.includes(role)) {
      continue;
    }
    enabled.push(module);
  }
  return enabled.sort((a, b) => lowestNavOrder(a) - lowestNavOrder(b));
}

/**
 * Module-switcher rows for owner/admin: every registered module visible to `role`
 * (per getEnabledModules), excluding `currentId`. Returns [] for any other role.
 * No org is available here, so the org-enabled gate is not applied: every registered
 * module is treated as enabled and only the role gate (requiredRoles) filters.
 */
export function moduleSwitcherItems(
  currentId: string,
  role: string | null | undefined,
): { label: string; route: string }[] {
  if (role !== 'owner' && role !== 'admin') {
    return [];
  }
  const org = { enabledModules: Array.from(registry.keys()) } as unknown as Organization;
  return getEnabledModules(org, role as Role)
    .filter((m) => m.id !== currentId)
    .filter((m) => !m.hideFromSwitcher)
    .map((m) => ({ label: m.displayName, route: `/m/${m.id}` }));
}

/** Lowest NavEntry.order for a module; modules with no nav entries sort last. */
function lowestNavOrder(m: JobcoreModule): number {
  let lowest = Number.POSITIVE_INFINITY;
  for (const entry of m.navEntries) {
    if (entry.order < lowest) {
      lowest = entry.order;
    }
  }
  return lowest;
}
