/**
 * Lead intake adapter contract (P7 Slice A).
 *
 * Interface only — NO implementation lives here. Mirrors the shape of
 * `../../sales-marketing/src/domain/providers/types.ts`'s `SocialProvider`:
 * a small interface with an `id`, implemented by concrete adapters and
 * looked up through a registry (`intake-registry.ts`), never imported
 * directly by callers.
 *
 * Do-NOT-build (per the P7 plan, deferred to live-Supabase work): no
 * `PollingAdapter`, no `WebhookAdapter`, no external-id dedup, no
 * signature/replay verification. This slice only defines the seam and two
 * in-process adapters (`manual-entry-adapter.ts`, `mock-feed-adapter.ts`).
 */

import type { RawLead } from '../domain/intake-normalize';

/**
 * One lead as handed back by a feed-style adapter's `fetchSince` — a
 * `RawLead` plus the feed's own opaque record id and timestamp, used only
 * for the `since` cursor in this in-process slice (no dedup, no persistence
 * of `externalId`).
 */
export interface MockFeedEntry {
  externalId: string;
  occurredAt: string;
  lead: RawLead;
}

/**
 * A source of new leads. `id` identifies the adapter for
 * `resolveIntakeAdapter` lookups (e.g. `'manual-entry'`, `'mock-feed'`).
 *
 * `fetchSince(sinceIso)` returns every lead the adapter knows about at or
 * after `sinceIso` (an ISO-8601 timestamp), each still in raw wire shape —
 * normalization (`normalizeRawLead`) happens in the caller
 * (`intake-sync.ts`'s `runIntakeSync`), not inside the adapter.
 */
export interface LeadIntakeAdapter {
  readonly id: string;
  fetchSince(sinceIso: string): Promise<readonly RawLead[]>;
}
