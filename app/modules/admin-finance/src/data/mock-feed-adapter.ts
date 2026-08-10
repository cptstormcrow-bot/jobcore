/**
 * Mock feed lead intake adapter (P7 Slice A).
 *
 * Stands in for a real polling/webhook feed (both explicitly deferred per
 * the P7 plan) so `runIntakeSync` (`intake-sync.ts`) and the intake
 * registry can be exercised with a second adapter that behaves like an
 * external source — fixed, seedable entries rather than a live store a
 * caller writes into (contrast `ManualEntryAdapter`).
 */

import type { LeadIntakeAdapter, MockFeedEntry } from './intake-adapter';
import type { RawLead } from '../domain/intake-normalize';

/**
 * `LeadIntakeAdapter` backed by a fixed list of `MockFeedEntry` records
 * supplied at construction (see `fixtures/raw-leads.ts` for the canonical
 * fixture set). `fetchSince` filters by `occurredAt`, mirroring how a real
 * feed adapter would use its own cursor field — no external-id dedup is
 * performed (deferred per the plan).
 */
export class MockFeedAdapter implements LeadIntakeAdapter {
  readonly id = 'mock-feed';

  private readonly entries: readonly MockFeedEntry[];

  constructor(entries: readonly MockFeedEntry[]) {
    this.entries = entries;
  }

  async fetchSince(sinceIso: string): Promise<readonly RawLead[]> {
    return this.entries
      .filter((entry) => entry.occurredAt >= sinceIso)
      .map((entry) => entry.lead);
  }
}
