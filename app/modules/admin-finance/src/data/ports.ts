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
 */
export interface JobRepository {
  listForOrganization(organizationId: string): Promise<Job[]>;
  getById(jobId: string): Promise<Job | null>;
  patchScheduling(jobId: string, patch: JobSchedulingPatch): Promise<Job>;
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

// Re-exported so callers of this module don't also need a direct import
// from `../money/types` just to name the status union.
export type { PriceSheetStatus };
