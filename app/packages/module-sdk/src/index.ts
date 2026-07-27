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
import type { Organization, Role } from '@jobcore/core';

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

/** Register a module at compile time. Duplicate ids are a build-time bug. */
export function registerModule(m: JobcoreModule): void {
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
