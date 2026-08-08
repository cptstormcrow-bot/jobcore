/**
 * Data seam for the admin-finance module (P3d.1).
 *
 * Interfaces only — NO implementation. This file declares the snake_case
 * wire shapes, the row→domain mapper, and the repository ports the module
 * depends on; the host application injects concrete implementations
 * (sqlite, Supabase fetch, fixtures, whatever) behind these interfaces.
 * No sqlite, no fetch, no fixtures, no React live here.
 */

import type { Job, JobStatus } from '@jobcore/core';
import type { PriceSheet, PriceSheetStatus } from '../money/types';
import type { PayPeriod } from '../money/rollup';
import type { Lead } from '../domain/lead';
import type { JobDraft } from '../domain/qualify';

/* ------------------------------------------------------------------ *
 * Job row (snake_case) → domain type (camelCase)
 * ------------------------------------------------------------------ */

/**
 * Mirrors the Supabase `jobs` table. Snake_case wire shape of `Job`.
 * `status` is `string`, not `JobStatus` — it is untrusted wire data until
 * `toJob` validates it against the full enum.
 */
export interface JobRow {
  id: string;
  organization_id: string;
  status: string;
  customer_id: string | null;
  service_id: string | null;
  source: string | null;
  payer: string | null;
  attach_timing: string | null;
  requested_window: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  address: string | null;
  description: string | null;
  assigned_tech_id: string | null;
  en_route_at: string | null;
  in_progress_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * The full `JobStatus` union, restated as a runtime tuple so `toJob` can
 * validate an untrusted row's `status` string against it. Order matches
 * the SQL `create type` in `@jobcore/core` — keep the two in sync.
 */
const JOB_STATUSES: readonly JobStatus[] = [
  'new',
  'qualified',
  'scheduled',
  'assigned',
  'accepted',
  'en_route',
  'in_progress',
  'completed',
  'paid',
  'closed',
  'declined',
  'needs_reschedule',
  'cancelled',
];

function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

/**
 * Map a `jobs` row to the domain `Job`.
 * Throws on an unrecognized status rather than widening the union — an
 * unknown status must fail closed, never degrade into an unchecked value
 * that later slips past `applyTransition`'s precondition checks.
 */
export function toJob(row: JobRow): Job {
  if (!isJobStatus(row.status)) {
    throw new Error(`Unknown status "${row.status}" on job ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: row.status,
    customerId: row.customer_id,
    serviceId: row.service_id,
    source: row.source,
    payer: row.payer,
    attachTiming: row.attach_timing,
    requestedWindow: row.requested_window,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    address: row.address,
    description: row.description,
    assignedTechId: row.assigned_tech_id,
    enRouteAt: row.en_route_at,
    inProgressAt: row.in_progress_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ *
 * Scheduling patch (AC-4 mechanism 1)
 * ------------------------------------------------------------------ */

/**
 * AC-4 mechanism 1: the only shape a caller may use to patch a job's
 * scheduling fields through `JobRepository.patchScheduling`. `status` is
 * deliberately absent from `Pick<Job, ...>` here — assigning
 * `{ status: ... }` to this type is a TS excess-property error, so a
 * status change can only move through `applyTransition` in
 * `@jobcore/core`, never through this data seam.
 */
export type JobSchedulingPatch = Partial<
  Pick<Job, 'assignedTechId' | 'scheduledStart' | 'scheduledEnd' | 'requestedWindow'>
>;

/* ------------------------------------------------------------------ *
 * Repository ports
 * ------------------------------------------------------------------ */

/**
 * Read + scheduling-patch access to jobs. Deliberately has NO status-write
 * method — status transitions are owned exclusively by `applyTransition`
 * in `@jobcore/core`, never by this repository.
 *
 * `create` (P3f.5a) is the one exception to "no status-write": it inserts
 * a brand-new row, so there is no prior status to bypass — `JobDraft.status`
 * is always the literal `'new'` (`domain/qualify.ts`'s `buildJobFromLead`
 * is the only producer of a `JobDraft`). Every status change AFTER the row
 * exists still goes through `domain/transition.ts`'s `transitionJob`, never
 * through this method again. The returned `Job` carries the
 * server-assigned `id`/`createdAt`; `JobDraft.serviceAreaId` is persisted by
 * the implementation but is not part of `Job` (see `qualify.ts`'s doc
 * comment) so it does not round-trip in the return value.
 */
export interface JobRepository {
  listForOrganization(organizationId: string): Promise<Job[]>;
  getById(jobId: string): Promise<Job | null>;
  patchScheduling(jobId: string, patch: JobSchedulingPatch): Promise<Job>;
  create(draft: JobDraft): Promise<Job>;
}

/** Read-only access to price sheets. */
export interface PriceSheetRepository {
  listForOrganization(organizationId: string): Promise<PriceSheet[]>;
  /** The single `published` price sheet currently in effect, if any. */
  getActive(organizationId: string): Promise<PriceSheet | null>;
}

/** Read-only access to pay periods. */
export interface PayPeriodRepository {
  listForOrganization(organizationId: string): Promise<PayPeriod[]>;
  getById(payPeriodId: string): Promise<PayPeriod | null>;
}

/**
 * Read + qualify-write access to leads (P3e.5, P3f.5c). `listForOrganization`
 * is P3e.5's read; `markQualified` is P3-f's one write, added once qualifying
 * a lead (filling in the missing fields `lead-readiness.ts` reports) and
 * converting it into a job became this group's concern.
 *
 * `markQualified` stamps the SAME two columns `toLead`/`LeadRow` already
 * declare (`leads.qualified_at`, `leads.converted_job_id` —
 * `supabase/0004_scheduling.sql:64-82`) — no schema or domain-type widening
 * needed, unlike `JobRepository.create`'s `serviceAreaId` case. AC-2: "stamps
 * `converted_job_id` on the lead."
 */
export interface LeadRepository {
  listForOrganization(organizationId: string): Promise<Lead[]>;
  markQualified(leadId: string, jobId: string, qualifiedAt: string): Promise<Lead>;
}

/* ------------------------------------------------------------------ *
 * Tech + assignment ports (P3g.6a — additive, supporting the assignment
 * board's assign-job flow; not part of the original P3d.1 port list).
 * ------------------------------------------------------------------ */

/**
 * The tech shape the assignment board / assign-job flow needs. `@jobcore/core`
 * has no dedicated `Tech` type — a tech is a `Profile` with `role: 'tech'` —
 * this port takes the same narrow structural slice `TechColumn.tsx`'s
 * `TechColumnTech` already declares, rather than depending on the full
 * `Profile` shape.
 */
export interface Tech {
  id: string;
  fullName: string;
}

/** Read-only access to the active tech roster. */
export interface TechRepository {
  /** Active techs (`role === 'tech' && active === true`) for the org. */
  listActiveTechs(organizationId: string): Promise<Tech[]>;
}

/**
 * Fields needed to insert one `job_assignments` row
 * (`app/supabase/0004_scheduling.sql`: `id`, `organization_id`, `job_id`,
 * `tech_id`, `assigned_at`, `created_at` — `id`/`organization_id`/
 * `created_at` are implementation-assigned, so this draft carries only the
 * caller-supplied fields).
 */
export interface JobAssignmentDraft {
  jobId: string;
  techId: string;
  assignedAt: string;
}

/** Write access to `job_assignments`. Insert-only — no update/delete needed by this group. */
export interface JobAssignmentRepository {
  create(organizationId: string, draft: JobAssignmentDraft): Promise<void>;
}

// Re-exported so callers of this module don't also need a direct import
// from `../money/types` just to name the status union.
export type { PriceSheetStatus };
