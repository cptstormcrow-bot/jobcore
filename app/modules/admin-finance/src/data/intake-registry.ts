/**
 * Lead intake adapter registry (P7 Slice A) — mirrors
 * `modules/sales-marketing/src/domain/providers/index.ts`'s
 * `getProvider`/`listProviders` pattern. Callers resolve an adapter only
 * through `resolveIntakeAdapter`, never by importing a concrete adapter
 * module directly — that indirection is what lets a later adapter (a real
 * `PollingAdapter`/`WebhookAdapter`, deferred per the plan) register
 * without changing any call site.
 *
 * No `process.env` read lives in this module — the configured adapter id
 * is a caller-supplied argument, matching the rest of `modules/`'s
 * discipline of staying free of environment/runtime concerns.
 */

import type { LeadIntakeAdapter } from './intake-adapter';
import { defaultManualEntryAdapter } from './manual-entry-adapter';

const ADAPTERS: readonly LeadIntakeAdapter[] = [defaultManualEntryAdapter];

/** Looks up a registered adapter by id. `undefined` if not registered. */
export function getIntakeAdapter(id: string): LeadIntakeAdapter | undefined {
  return ADAPTERS.find((adapter) => adapter.id === id);
}

/** All registered adapters, in registration order. */
export function listIntakeAdapters(): readonly LeadIntakeAdapter[] {
  return ADAPTERS;
}

/**
 * Resolves the adapter to sync from. `configuredId === undefined` (no
 * adapter configured) defaults to `defaultManualEntryAdapter` — the only
 * adapter that requires no external source to function. An unrecognized
 * configured id throws rather than silently falling back, so a
 * misconfiguration is caught at the call site instead of quietly
 * defaulting to manual entry.
 */
export function resolveIntakeAdapter(configuredId: string | undefined): LeadIntakeAdapter {
  if (configuredId === undefined) {
    return defaultManualEntryAdapter;
  }
  const adapter = getIntakeAdapter(configuredId);
  if (!adapter) {
    throw new Error(`Unknown lead intake adapter id "${configuredId}"`);
  }
  return adapter;
}

export type { LeadIntakeAdapter, MockFeedEntry } from './intake-adapter';
export { ManualEntryAdapter, InMemoryManualLeadStore, defaultManualEntryAdapter } from './manual-entry-adapter';
export { MockFeedAdapter } from './mock-feed-adapter';
