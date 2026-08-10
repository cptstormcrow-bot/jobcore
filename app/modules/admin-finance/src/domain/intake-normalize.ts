/**
 * Lead intake normalization (P7 Slice A).
 *
 * Pure domain logic — no DB, no network, no clock read. Takes the raw shape
 * an intake adapter hands back (`RawLead`) and produces the insertable draft
 * (`NewLeadDraft`) plus a review-flag classification (`NormalizedLead`).
 *
 * Mirrors `qualify.ts`'s style: one pure function, one result-shaped return.
 * `NewLeadDraft` mirrors `LeadRow`'s insertable columns minus the
 * server-assigned lifecycle fields (`id`, `qualified_at`, `converted_job_id`,
 * `created_at`) — same discipline as `qualify.ts`'s `JobDraft` vs `Job`.
 */

/** The three axis fields the website's intake forms may omit. */
export type AxisField = 'source' | 'payer' | 'attachTiming';

/**
 * Defaults applied when an axis field is missing from a `RawLead`. Mirrors
 * the `jobs`/`leads` table convention: a lead with no stated source is
 * treated as a direct/organic contact, paid by the customer, attached at
 * time of purchase — the most common case, not a guess pulled from nowhere.
 */
export const DEFAULT_AXIS_VALUES: { source: 'direct'; payer: 'customer'; attachTiming: 'at_purchase' } = {
  source: 'direct',
  payer: 'customer',
  attachTiming: 'at_purchase',
};

/**
 * The shape an intake adapter (`data/intake-adapter.ts`'s `LeadIntakeAdapter`)
 * hands back — untrusted wire data, not yet an organization-scoped, defaulted
 * draft. The nine customer-facing fields mirror `domain/lead.ts`'s `Lead`
 * (minus server-assigned id/timestamps); the three axis fields are optional
 * because the website's hero quick form genuinely never collects them.
 */
export interface RawLead {
  sourceForm: string;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  address: string | null;
  projectDetails: string | null;
  source?: string | null;
  payer?: string | null;
  attachTiming?: string | null;
}

/**
 * The insertable draft a `LeadRepository.create` call expects. Every axis
 * field is populated (never optional) — `normalizeRawLead` is the ONLY
 * producer of this type, and it always fills gaps with `DEFAULT_AXIS_VALUES`.
 */
export interface NewLeadDraft {
  organizationId: string;
  sourceForm: string;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  address: string | null;
  projectDetails: string | null;
  source: string;
  payer: string;
  attachTiming: string;
}

/**
 * The result of `normalizeRawLead`. `assumedAxisFields` names every axis
 * field the raw lead was missing (in `AxisField` declaration order);
 * `flaggedForReview` is derived — true iff at least one axis field was
 * assumed rather than stated by the source.
 *
 * This flag is computed/in-process only for this slice (P7 Slice A) — no
 * `leads.axis_flagged_for_review` column exists yet; persisting it durably
 * needs a live-Supabase migration, deferred per the P7 no-Supabase plan.
 */
export interface NormalizedLead {
  draft: NewLeadDraft;
  assumedAxisFields: readonly AxisField[];
  flaggedForReview: boolean;
}

/**
 * Normalizes a `RawLead` into a `NewLeadDraft`, defaulting any missing axis
 * field and reporting which ones were assumed. Pure: `organizationId` is
 * caller-supplied, never inferred, matching `buildJobFromLead`'s discipline
 * of never guessing identity fields.
 */
export function normalizeRawLead(raw: RawLead, organizationId: string): NormalizedLead {
  const assumedAxisFields: AxisField[] = [];

  const source = raw.source ?? null;
  const payer = raw.payer ?? null;
  const attachTiming = raw.attachTiming ?? null;

  if (source === null) {
    assumedAxisFields.push('source');
  }
  if (payer === null) {
    assumedAxisFields.push('payer');
  }
  if (attachTiming === null) {
    assumedAxisFields.push('attachTiming');
  }

  const draft: NewLeadDraft = {
    organizationId,
    sourceForm: raw.sourceForm,
    name: raw.name,
    phone: raw.phone,
    email: raw.email,
    service: raw.service,
    preferredDate: raw.preferredDate,
    preferredTime: raw.preferredTime,
    address: raw.address,
    projectDetails: raw.projectDetails,
    source: source ?? DEFAULT_AXIS_VALUES.source,
    payer: payer ?? DEFAULT_AXIS_VALUES.payer,
    attachTiming: attachTiming ?? DEFAULT_AXIS_VALUES.attachTiming,
  };

  return {
    draft,
    assumedAxisFields,
    flaggedForReview: assumedAxisFields.length > 0,
  };
}
