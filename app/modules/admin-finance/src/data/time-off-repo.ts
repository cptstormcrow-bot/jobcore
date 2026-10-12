/**
 * Admin-facing data seam for time-off approve/deny (Workstream F, 4b).
 *
 * Interfaces only — NO Supabase implementation lives here, matching
 * `reimbursement-repo.ts`'s discipline. Distinct from
 * `modules/field-tech/src/data/ports.ts`'s `TimeOffRepository`, which is
 * tech-scoped (`listForTech` / `create` only, no admin-wide list or
 * approve/deny). This file owns the admin-wide row type, the row->domain
 * mapper, and the repo port for organization-scoped time-off review.
 *
 * Mirrors `time_off_requests` (`app/supabase/0007_field_tech_tables.sql`
 * L101-115): `status` starts `'pending'`, moves to `'approved'`/`'denied'`
 * only via an org admin, enforced by the `time_off_requests_admin_all` RLS
 * policy (L280-284 of the same migration) rather than by this file.
 *
 * Unlike reimbursements, time-off has no admin approve/deny step: a database
 * trigger auto-decides each request (admin-created blackouts are
 * auto-approved; migration 0035), so approve/deny are no longer exposed on
 * this repo. `cancel` is the only admin mutation besides create.
 */

/* ------------------------------------------------------------------ *
 * time_off_requests row (snake_case) -> domain type (camelCase)
 * ------------------------------------------------------------------ */

/** Mirrors `time_off_requests_status_check`, as widened by `app/supabase/0019_time_off_auto_decide.sql` (originally `app/supabase/0007_field_tech_tables.sql` L111-112) to include `'cancelled'`. */
export type TimeOffStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

const TIME_OFF_STATUSES: readonly TimeOffStatus[] = ['pending', 'approved', 'denied', 'cancelled'];

function isTimeOffStatus(value: string): value is TimeOffStatus {
  return (TIME_OFF_STATUSES as readonly string[]).includes(value);
}

/** Mirrors the Supabase `time_off_requests` table. `status` is untrusted wire data until `toTimeOffRequestAdmin` validates it. */
export interface TimeOffRequestAdminRow {
  id: string;
  organization_id: string;
  tech_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by_admin_id: string | null;
}

/** Admin-facing domain shape of a time-off request. */
export interface TimeOffRequestAdmin {
  id: string;
  organizationId: string;
  techId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: TimeOffStatus;
  createdAt: string;
  updatedAt: string;
  createdByAdminId: string | null;
}

/**
 * Map a `time_off_requests` row to the admin domain `TimeOffRequestAdmin`.
 * Throws on an unrecognized status rather than widening the union, matching
 * `reimbursement-repo.ts`'s `toReimbursement` discipline.
 */
export function toTimeOffRequestAdmin(row: TimeOffRequestAdminRow): TimeOffRequestAdmin {
  if (!isTimeOffStatus(row.status)) {
    throw new Error(`Unknown time off status "${row.status}" on request ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    techId: row.tech_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByAdminId: row.created_by_admin_id ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Repository port
 * ------------------------------------------------------------------ */

/**
 * Admin-wide read + create/cancel access to time-off requests. Distinct from
 * field-tech's `TimeOffRepository`, which only exposes `listForTech` /
 * `create` for the requesting tech's own view.
 *
 * A database trigger auto-decides each request (migration 0035), so there is
 * no approve/deny here. `createBlackout(organizationId, techId, draft)` is
 * used by the #0056 Add Blackout calendar screen (`BlackoutEditorScreen`);
 * admin-created blackouts are auto-approved. `cancel` is the only admin
 * mutation besides create.
 */
export interface TimeOffAdminRepo {
  /** All time-off requests for the organization, in any status. */
  listForOrganization(organizationId: string): Promise<TimeOffRequestAdmin[]>;

  /** Admin-entered blackout: a time-off request the admin creates directly for a tech, bypassing tech self-service. */
  createBlackout(
    organizationId: string,
    techId: string,
    draft: { startDate: string; endDate: string; reason: string | null },
  ): Promise<TimeOffRequestAdmin>;

  /** Cancels an existing time-off request by id. */
  cancel(requestId: string): Promise<void>;
}
