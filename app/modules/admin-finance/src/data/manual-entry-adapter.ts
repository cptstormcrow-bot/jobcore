/**
 * Manual-entry lead intake adapter (P7 Slice A) — the default adapter
 * `resolveIntakeAdapter` (`intake-registry.ts`) falls back to when no
 * adapter id is configured.
 *
 * "Manual entry" means a human (office staff) keys a lead in directly —
 * there is no external feed to poll. The adapter's `fetchSince` surface is
 * satisfied by an in-memory store that `.submit()` writes into; a real
 * deployment would back `ManualLeadStore` with a DB table, but that wiring
 * is deferred (no live Supabase in this slice).
 */

import type { LeadIntakeAdapter } from './intake-adapter';
import type { RawLead } from '../domain/intake-normalize';

export interface StoredEntry {
  submittedAt: string;
  lead: RawLead;
}

/**
 * Storage port a `ManualEntryAdapter` reads from and writes to. Kept as an
 * interface (not tied to `InMemoryManualLeadStore`) so a future DB-backed
 * store can implement it without touching the adapter.
 */
export interface ManualLeadStore {
  submit(lead: RawLead, submittedAt: string): void;
  listSince(sinceIso: string): readonly StoredEntry[];
}

/**
 * In-memory `ManualLeadStore` — entries live for the process lifetime only.
 * Suitable for this slice's tests and for a single-process deployment; not
 * a substitute for a durable table.
 */
export class InMemoryManualLeadStore implements ManualLeadStore {
  private readonly entries: StoredEntry[] = [];

  submit(lead: RawLead, submittedAt: string): void {
    this.entries.push({ lead, submittedAt });
  }

  listSince(sinceIso: string): readonly StoredEntry[] {
    return this.entries.filter((entry) => entry.submittedAt >= sinceIso);
  }
}

/**
 * `LeadIntakeAdapter` backed by a `ManualLeadStore`. `.submit()` is the
 * staff-facing seam (called when a human keys a lead in); `fetchSince`
 * satisfies the adapter contract that `runIntakeSync` (`intake-sync.ts`)
 * drives uniformly across every adapter.
 */
export class ManualEntryAdapter implements LeadIntakeAdapter {
  readonly id = 'manual-entry';

  private readonly store: ManualLeadStore;

  constructor(store: ManualLeadStore) {
    this.store = store;
  }

  submit(lead: RawLead, submittedAt: string): void {
    this.store.submit(lead, submittedAt);
  }

  async fetchSince(sinceIso: string): Promise<readonly RawLead[]> {
    return this.store.listSince(sinceIso).map((entry) => entry.lead);
  }
}

/**
 * The default `ManualEntryAdapter` instance, backed by a fresh
 * `InMemoryManualLeadStore`. `intake-registry.ts`'s `resolveIntakeAdapter`
 * returns this when given `undefined`.
 */
export const defaultManualEntryAdapter: ManualEntryAdapter = new ManualEntryAdapter(
  new InMemoryManualLeadStore(),
);
