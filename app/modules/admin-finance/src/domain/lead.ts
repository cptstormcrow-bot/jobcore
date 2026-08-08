/**
 * Lead domain type (P3e.1).
 *
 * Mirrors the Supabase `leads` table (`supabase/0004_scheduling.sql:64-82`)
 * exactly — the website's nine intake columns (source_form, name, phone,
 * email, service, preferred_date, preferred_time, address, project_details)
 * plus the same source/payer/attach_timing/qualified_at/converted_job_id
 * fields the `jobs` table carries, so a lead can convert into a job with no
 * lossy translation.
 *
 * `attachTiming` is plain `string | null` here, NOT an enum — unlike
 * `Job.attachTiming` in `@jobcore/core`, the `leads.attach_timing` column is
 * untyped `text` at the DB level (no check constraint, no enum), so widening
 * it into a closed union would be inventing a constraint the schema does not
 * actually enforce.
 *
 * `name` and `createdAt` are the only fields the DB marks `not null`
 * (besides `id`/`organizationId`) — every other intake field mirrors the
 * "hero quick form vs. booking form" split in `00-MASTER-SPEC.md`: a lead
 * can genuinely arrive with `preferredDate`, `address`, and most other
 * fields null. `domain/lead-readiness.ts` is what turns that possibility
 * into a first-class, never-hidden classification — this file only
 * describes the honest shape.
 */

/** Mirrors the Supabase `leads` table. Snake_case wire shape of `Lead`. */
export interface LeadRow {
  id: string;
  organization_id: string;
  source_form: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  address: string | null;
  project_details: string | null;
  source: string | null;
  payer: string | null;
  attach_timing: string | null;
  qualified_at: string | null;
  converted_job_id: string | null;
  created_at: string;
}

/** Domain `Lead` — camelCase mirror of `LeadRow`. */
export interface Lead {
  id: string;
  organizationId: string;
  sourceForm: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  address: string | null;
  projectDetails: string | null;
  source: string | null;
  payer: string | null;
  attachTiming: string | null;
  qualifiedAt: string | null;
  convertedJobId: string | null;
  createdAt: string;
}

/**
 * Map a `leads` row to the domain `Lead`. No enum validation is needed here
 * (unlike `toJob`) because every nullable text column on this table is
 * genuinely untyped free text at the DB level — there is nothing to fail
 * closed against.
 */
export function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceForm: row.source_form,
    name: row.name,
    phone: row.phone,
    email: row.email,
    service: row.service,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    address: row.address,
    projectDetails: row.project_details,
    source: row.source,
    payer: row.payer,
    attachTiming: row.attach_timing,
    qualifiedAt: row.qualified_at,
    convertedJobId: row.converted_job_id,
    createdAt: row.created_at,
  };
}
