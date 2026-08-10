/**
 * Intake sync orchestration (P7 Slice A).
 *
 * `runIntakeSync` is the one place adapter, normalization, and repository
 * meet: it drives any `LeadIntakeAdapter` uniformly (adapter-swap
 * transparency — swapping `ManualEntryAdapter` for `MockFeedAdapter`
 * changes nothing else), normalizes each raw lead, persists it through
 * `LeadRepository.create`, and reports which created leads were flagged for
 * review because an axis field had to be assumed.
 *
 * The review flag stays in-process/computed for this slice — it is derived
 * from `normalizeRawLead`'s output at sync time, not read back from a
 * durable column (no `leads.axis_flagged_for_review` migration; deferred
 * per the P7 no-Supabase plan).
 */

import type { LeadIntakeAdapter } from './intake-adapter';
import type { LeadRepository } from './ports';
import type { Lead } from '../domain/lead';
import { normalizeRawLead } from '../domain/intake-normalize';

/** One created lead's outcome from a sync run. */
export interface IntakeSyncLeadOutcome {
  lead: Lead;
  flaggedForReview: boolean;
}

/**
 * Summary of one `runIntakeSync` call: every lead created, plus the subset
 * flagged for review (same objects, filtered — convenience for callers that
 * only care about the review queue).
 */
export interface IntakeSyncResult {
  adapterId: string;
  created: readonly IntakeSyncLeadOutcome[];
  flaggedForReview: readonly IntakeSyncLeadOutcome[];
}

/**
 * Fetches every raw lead the adapter reports since `sinceIso`, normalizes
 * each one against `organizationId`, and persists it via
 * `repository.create`. Leads are processed sequentially (not
 * `Promise.all`) so a single failing insert reports a stack trace pointing
 * at the offending lead rather than an aggregate rejection.
 */
export async function runIntakeSync(
  adapter: LeadIntakeAdapter,
  repository: Pick<LeadRepository, 'create'>,
  organizationId: string,
  sinceIso: string,
): Promise<IntakeSyncResult> {
  const rawLeads = await adapter.fetchSince(sinceIso);

  const created: IntakeSyncLeadOutcome[] = [];
  for (const raw of rawLeads) {
    const normalized = normalizeRawLead(raw, organizationId);
    const lead = await repository.create(normalized.draft);
    created.push({ lead, flaggedForReview: normalized.flaggedForReview });
  }

  return {
    adapterId: adapter.id,
    created,
    flaggedForReview: created.filter((outcome) => outcome.flaggedForReview),
  };
}
