/**
 * Lead domain type (P3e.1).
 *
 * Mirrors the Supabase `leads` table (`supabase/migrations/0004_scheduling.sql:64-82`)
 * exactly — the website's nine intake columns (source_form, name, phone,
 * email, service, preferred_date, preferred_time, address, project_details)
 * plus the same source/payer/attach_timing/qualified_at/converted_job_id
 * fields the `jobs` table carries, so a lead can convert into a job with no
 * lossy translation.
 *
 * `source`/`payer`/`attachTiming` are plain `string | null` here, NOT enums.
 * Since `0022_leads_source_check.sql`, `source` IS constrained at the DB
 * level (website|costco|ikea|owm) but is kept as `string | null` at this
 * layer rather than a closed union — see `domain/intake-normalize.ts`'s
 * `SOURCE_VALUES`/`AxisField` for the enforced picker-facing union.
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
 * Map a `leads` row to the domain `Lead`. No enum validation is done here
 * (unlike `toJob`) even though `source` is now DB-constrained since 0022 —
 * this mapper stays a passthrough; enforcement lives at the picker layer
 * (`domain/intake-normalize.ts`'s `SOURCE_VALUES`).
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
