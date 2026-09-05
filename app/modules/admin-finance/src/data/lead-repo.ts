/**
 * Lead data seam (S1 of the admin-finance overview plan).
 *
 * Concrete Supabase-backed implementation of the read/write operations
 * `ports.ts`'s `LeadRepository` interface declares, plus a patch/update
 * operation that interface does not yet declare (see `LeadPatchInput`
 * below). Mirrors the plain-async-function convention established by
 * `service-area-repo.ts` / `tech-skill-repo.ts`: a minimal `{ from }`
 * Supabase client shape (no hard `@supabase/supabase-js` import), and a
 * `CalculationResult<T>` return on every function instead of throwing.
 */

import type { CalculationResult } from '../money/types';
import type { NewLeadDraft } from '../domain/intake-normalize';
import { toLead, type Lead, type LeadRow } from './ports';

// Minimal client seam matching the real Supabase query-builder's chainable
// shape without importing @supabase/supabase-js's generics here, same
// pattern as SupabaseServiceAreasClient / SupabaseTechSkillsClient.
interface SupabaseLeadsClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

/**
 * All leads for an organization, newest first is NOT guaranteed here —
 * ordering is left to the caller/query; this mirrors `listServiceAreas`'s
 * bare `.select('*').eq(...)` shape.
 */
export async function listLeadsForOrganization(
  client: SupabaseLeadsClient,
  organizationId: string
): Promise<CalculationResult<Lead[]>> {
  const { data, error } = await client
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId);
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: (data ?? []).map(toLead) };
}

/**
 * Inserts a new lead row from a `NewLeadDraft` (the only producer is
 * `domain/intake-normalize.ts`'s `normalizeRawLead`). `qualified_at` and
 * `converted_job_id` are left unset on insert — the DB defaults them to
 * null, matching `toLead`'s fresh-creation contract.
 */
export async function createLead(
  client: SupabaseLeadsClient,
  draft: NewLeadDraft
): Promise<CalculationResult<Lead>> {
  const { data, error } = await client
    .from('leads')
    .insert({
      organization_id: draft.organizationId,
      source_form: draft.sourceForm,
      name: draft.name,
      phone: draft.phone,
      email: draft.email,
      service: draft.service,
      preferred_date: draft.preferredDate,
      preferred_time: draft.preferredTime,
      address: draft.address,
      project_details: draft.projectDetails,
      source: draft.source,
      payer: draft.payer,
      attach_timing: draft.attachTiming,
    })
    .select('*')
    .single();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toLead(data) };
}

/**
 * Stamps `leads.qualified_at` / `leads.converted_job_id` on conversion —
 * matches `ports.ts`'s `LeadRepository.markQualified` doc comment.
 */
export async function markLeadQualified(
  client: SupabaseLeadsClient,
  leadId: string,
  jobId: string,
  qualifiedAt: string
): Promise<CalculationResult<Lead>> {
  const { data, error } = await client
    .from('leads')
    .update({ qualified_at: qualifiedAt, converted_job_id: jobId })
    .eq('id', leadId)
    .select('*')
    .single();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toLead(data) };
}

/* ------------------------------------------------------------------ *
 * Patch (partial update) — NOT yet declared on ports.ts's
 * LeadRepository interface. `ports.ts` cannot import a type from this
 * file (repo files depend on ports.ts, not the reverse), so this type is
 * declared here, standalone, as `LeadPatchInput` — a later slice (S2) is
 * expected to alias/re-export it from `ports.ts` and add a matching
 * `update(...)` method to `LeadRepository`, rather than redefining the
 * field list independently.
 * ------------------------------------------------------------------ */

/**
 * The editable subset of `Lead` a patch/update call may change. Mirrors
 * the `Partial<Pick<X, ...>>` idiom `ports.ts` already uses for
 * `JobDetailsPatch`. Deliberately excludes identity/derived fields (`id`,
 * `organizationId`, `sourceForm`, `qualifiedAt`, `convertedJobId`,
 * `createdAt`) — those are never user-editable via this seam.
 */
export type LeadPatchInput = Partial<
  Pick<
    Lead,
    | 'name'
    | 'phone'
    | 'email'
    | 'service'
    | 'preferredDate'
    | 'preferredTime'
    | 'address'
    | 'projectDetails'
    | 'source'
    | 'payer'
    | 'attachTiming'
  >
>;

/** Snake_case row-patch shape `toLeadRowPatch` produces for the `.update(...)` call. */
type LeadRowPatch = Partial<
  Pick<
    LeadRow,
    | 'name'
    | 'phone'
    | 'email'
    | 'service'
    | 'preferred_date'
    | 'preferred_time'
    | 'address'
    | 'project_details'
    | 'source'
    | 'payer'
    | 'attach_timing'
  >
>;

/**
 * Converts a `LeadPatchInput` (camelCase, domain-shaped) into the
 * snake_case row-patch object Supabase's `.update(...)` expects. Only
 * keys actually present on `patch` are copied — an omitted field must
 * stay untouched by the update, not get overwritten with `undefined`.
 */
export function toLeadRowPatch(patch: LeadPatchInput): LeadRowPatch {
  const rowPatch: LeadRowPatch = {};
  if ('name' in patch) rowPatch.name = patch.name;
  if ('phone' in patch) rowPatch.phone = patch.phone;
  if ('email' in patch) rowPatch.email = patch.email;
  if ('service' in patch) rowPatch.service = patch.service;
  if ('preferredDate' in patch) rowPatch.preferred_date = patch.preferredDate;
  if ('preferredTime' in patch) rowPatch.preferred_time = patch.preferredTime;
  if ('address' in patch) rowPatch.address = patch.address;
  if ('projectDetails' in patch) rowPatch.project_details = patch.projectDetails;
  if ('source' in patch) rowPatch.source = patch.source;
  if ('payer' in patch) rowPatch.payer = patch.payer;
  if ('attachTiming' in patch) rowPatch.attach_timing = patch.attachTiming;
  return rowPatch;
}

/**
 * Applies a `LeadPatchInput` to one lead row. Not yet part of
 * `ports.ts`'s `LeadRepository` interface (see the file-top note) — this
 * function is the concrete seam a later slice wires in.
 */
export async function updateLead(
  client: SupabaseLeadsClient,
  leadId: string,
  patch: LeadPatchInput
): Promise<CalculationResult<Lead>> {
  const { data, error } = await client
    .from('leads')
    .update(toLeadRowPatch(patch))
    .eq('id', leadId)
    .select('*')
    .single();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toLead(data) };
}
