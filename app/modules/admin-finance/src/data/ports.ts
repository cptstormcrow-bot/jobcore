/**
 * Data seam for the admin-finance module (P3d.1).
 *
 * Interfaces only — NO implementation. This file declares the snake_case
 * wire shapes, the row→domain mapper, and the repository ports the module
 * depends on; the host application injects concrete implementations
 * (sqlite, Supabase fetch, fixtures, whatever) behind these interfaces.
 * No sqlite, no fetch, no fixtures, no React live here.
 */

import type { Job, JobStatus, Commission, Profile, Role, VehicleStatus, ToolStatus } from '@jobcore/core';
import type { PriceSheet, PriceSheetStatus } from '../money/types';
import type { PayPeriod } from '../money/rollup';
import type { Lead } from '../domain/lead';
export type { Lead } from '../domain/lead';
export type { LeadRow } from '../domain/lead';
import type { LeadPatchInput as LeadPatch } from './lead-repo';
export { toLead } from '../domain/lead';
import type { JobDraft } from '../domain/qualify';
import type { NewLeadDraft } from '../domain/intake-normalize';
import type { CommissionLine } from '../money/types';

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
  job_number: number | null;
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
  is_beta: boolean | null;
  house_age_years: number | null;
  permit_status: string | null;
  parking_available: string | null;
  rooms: string[] | null;
  panel_info: string | null;
  considerations: string | null;
  ingress_instructions: string | null;
  service_area_id: string | null;
  total_labor_seconds: number | null;
  needs_prem_at?: string | null;
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
    jobNumber: row.job_number ?? null,
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
    isBeta: row.is_beta ?? false,
    houseAgeYears: row.house_age_years ?? null,
    permitStatus: row.permit_status,
    parkingAvailable: row.parking_available,
    rooms: row.rooms,
    panelInfo: row.panel_info,
    considerations: row.considerations,
    ingressInstructions: row.ingress_instructions,
    service_area_id: row.service_area_id,
    totalLaborSeconds: row.total_labor_seconds ?? 0,
    needsPremAt: row.needs_prem_at ?? null,
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

/**
 * AC-4-style mechanism for the job's editable descriptive fields. `status`
 * is deliberately absent, same invariant as `JobSchedulingPatch` above —
 * status changes only move through `applyTransition`/`transitionJob`,
 * never through this data seam.
 *
 * `houseAgeYears` now folds into the `Pick<Job, ...>` list like the rest
 * of this patch — `@jobcore/core`'s `Job` type declares
 * `houseAgeYears?: number | null`.
 */
export type JobLifecyclePatch = { enRouteAt?: string | null; inProgressAt?: string | null; completedAt?: string | null };

export type JobDetailsPatch = Partial<Pick<Job, 'address' | 'description' | 'houseAgeYears' | 'ingressInstructions'>> & {
  serviceAreaId?: string | null;
  permitStatus?: string | null;
  parkingAvailable?: string | null;
  rooms?: string[] | null;
  panelInfo?: string | null;
  considerations?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  customerId?: string | null;
};

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
  /**
   * Patches a job's editable descriptive fields (`JobDetailsPatch`) via the
   * same `.select().single()` + `toJob()` remap pattern `patchScheduling`
   * uses. Deliberately excludes `status` — see `JobDetailsPatch`'s doc
   * comment above.
   */
  updateDetails(jobId: string, patch: JobDetailsPatch): Promise<Job>;
  patchLifecycle(jobId: string, patch: JobLifecyclePatch): Promise<Job>;
  create(draft: JobDraft): Promise<Job>;
  /**
   * Persists the result of an in-memory `applyTransition`/`transitionJob`
   * call to `jobs.status` (cross-cutting fix — job status was computed but
   * never written back). Deliberately a separate method rather than
   * widening `JobSchedulingPatch`'s `Pick<Job, ...>` — that type's exclusion
   * of `status` is a documented invariant (see its doc comment above) that
   * a caller cannot slip a status change through `patchScheduling`; this
   * method is the one sanctioned status-write path, called only with the
   * `JobStatus` `applyTransition` already computed.
   */
  updateStatus(jobId: string, status: JobStatus): Promise<Job>;
  markBeta(jobId: string, isBeta: boolean): Promise<void>;
  setNeedsPrem?(jobId: string, at: string | null): Promise<void>;
  clearInvestigator(jobId: string): Promise<void>;
  /** Voids all time segments and zeroes total_labor_seconds (RPC reset_job_time_segments; admin-only). */ resetTimeSegments?(jobId: string): Promise<void>;
  /**
   * Third sanctioned status-write exception (alongside `create` and
   * `updateStatus`): atomically advances a job from `fromStatus` to `'paid'`,
   * logs the transition, writes its one commission row, and resolves any
   * open/retrying close_out_failures row — via the `close_out_job_write`
   * Postgres RPC (supabase/0026_close_out_write_rpc.sql). Replaces the three
   * separate non-atomic writes previously issued from
   * flows/close-out-job.ts (updateStatus + calendarEvents.logTransition +
   * commissions.create). Called only from the close-out flow, after its own
   * precondition checks have already run — the RPC re-validates the status
   * guard server-side regardless.
   */
  closeOutWrite(
    jobId: string,
    fromStatus: JobStatus,
    commission: CommissionLine,
    closedByUserId: string,
  ): Promise<Job>;
}

/**
 * Mirrors `NewLeadDraft`'s role for `LeadRepository.create`: the caller
 * supplies only these fields when creating a new price sheet. `id` is
 * server-assigned; `status` is NOT caller-supplied — the implementation
 * always creates the row with `status: 'draft'`; `publishedAt` starts `null`
 * and is only set later by the publish action, not at creation.
 */
export type PriceSheetDraft = Omit<PriceSheet, 'id' | 'status' | 'publishedAt'>;

/** Read + create access to price sheets. */
export interface PriceSheetRepository {
  listForOrganization(organizationId: string): Promise<PriceSheet[]>;
  /** The single `published` price sheet currently in effect, if any. */
  getActive(organizationId: string): Promise<PriceSheet | null>;
  create(draft: PriceSheetDraft): Promise<PriceSheet>;
}

export interface PriceSheetStandardDuration {
  organizationId: string;
  standardMinutes: number;
  updatedAt: string;
}

export interface PriceSheetStandardDurationRepository {
  get(organizationId: string): Promise<PriceSheetStandardDuration | null>;
  upsert(organizationId: string, standardMinutes: number): Promise<PriceSheetStandardDuration>;
}

/** Read-only access to pay periods. */
export interface PayPeriodRepository {
  listForOrganization(organizationId: string): Promise<PayPeriod[]>;
  getById(payPeriodId: string): Promise<PayPeriod | null>;
}

/**
 * Read + qualify-write + patch access to leads (P3e.5, P3f.5c, S2).
 * `listForOrganization` is P3e.5's read; `markQualified` is P3-f's one
 * write, added once qualifying a lead (filling in the missing fields
 * `lead-readiness.ts` reports) and converting it into a job became this
 * group's concern. `update` (S2) is the admin-finance overview's
 * edit-a-lead seam, backed by `data/lead-repo.ts`'s `updateLead`/
 * `toLeadRowPatch` — `LeadPatch` is that file's `LeadPatchInput`,
 * re-exported here so callers depend only on `ports.ts`.
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
  /**
   * Inserts a new lead row from an intake-normalized draft (P7 Slice A —
   * `domain/intake-normalize.ts`'s `normalizeRawLead` is the only producer
   * of a `NewLeadDraft`). The returned `Lead` carries the server-assigned
   * `id`/`createdAt`; `qualifiedAt`/`convertedJobId` are `null` on a
   * freshly created lead, matching `toLead`'s row mapping for an
   * unqualified lead.
   */
  create(draft: NewLeadDraft): Promise<Lead>;
  /**
   * Patches the editable subset of a lead (`LeadPatch`) via the same
   * `.update().select().single()` + `toLead()` remap pattern
   * `JobRepository.updateDetails` uses. Backed by `data/lead-repo.ts`'s
   * `updateLead`; excludes identity/derived fields the same way
   * `LeadPatch` does.
   */
  update(leadId: string, patch: LeadPatch): Promise<Lead>;
}

/**
 * Re-exported alias of `data/lead-repo.ts`'s `LeadPatchInput` — this file
 * cannot import from `lead-repo.ts` (repo files depend on `ports.ts`, not
 * the reverse), so the type is declared there and named here via `import
 * type` + re-export, letting `LeadRepository.update` reference it without
 * a circular import.
 */
export type { LeadPatchInput as LeadPatch } from './lead-repo';
export { toLeadRowPatch } from './lead-repo';

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
 * Minimal local `Invitation` type — `@jobcore/core` has no dedicated
 * `Invitation` export, so this mirrors the Supabase `invitations` table
 * (`app/supabase/0003_invitations_and_signup.sql`) at the domain-field
 * level this module needs, rather than defining a shared type upstream.
 */
export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  createdAt: string;
}

export class DuplicateInvitationError extends Error {
  readonly email: string;
  constructor(email: string) {
    super(`An invitation for ${email} is already pending.`);
    this.name = 'DuplicateInvitationError';
    this.email = email;
  }
}

/**
 * The full `VehicleStatus` union, restated as a runtime tuple so callers can
 * validate an untrusted wire value against it. Same idiom as `JOB_STATUSES`/
 * `isJobStatus` above. Exported (unlike `isJobStatus`) because the row→domain
 * mapper for `Profile` lives outside this file, in
 * `apps/mobile/src/lib/admin-finance-repos.ts`'s `toProfile`.
 */
export const VEHICLE_STATUSES: readonly VehicleStatus[] = ['assigned', 'unassigned', 'in_maintenance'];

export function isVehicleStatus(value: string): value is VehicleStatus {
  return (VEHICLE_STATUSES as readonly string[]).includes(value);
}

/** The full `ToolStatus` union, restated as a runtime tuple. Same idiom and export rationale as `VEHICLE_STATUSES` above. */
export const TOOL_STATUSES: readonly ToolStatus[] = ['issued', 'not_issued', 'needs_replacement'];

export function isToolStatus(value: string): value is ToolStatus {
  return (TOOL_STATUSES as readonly string[]).includes(value);
}

/** Admin-only fields from public.profile_private (RLS admin_all). Non-admins receive null. */
export interface ProfilePrivate {
  ssnLast4: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

/** Read/write access to organization employees (`Profile` rows). */
export interface EmployeeRepository {
  listEmployees(organizationId: string): Promise<Profile[]>;
  getEmployee(profileId: string): Promise<Profile | null>;
  updateEmployee(
    profileId: string,
    updates: {
      fullName?: string;
      phone?: string | null;
      isTest?: boolean;
      address?: string | null;
      driversLicenseNumber?: string | null;
      vehicleStatus?: VehicleStatus | null;
      toolStatus?: ToolStatus | null;
      paidTravel?: boolean;
      paidTravelPolicyMessage?: string | null;
      defaultHourlyRateCents?: number;
      testJobsOnly?: boolean;
    }
  ): Promise<void>;
  deactivateEmployee(profileId: string): Promise<void>;
  reactivateEmployee(profileId: string): Promise<void>;
  setEmployeeRole(profileId: string, role: Role): Promise<void>;
  getPrivate(profileId: string): Promise<ProfilePrivate | null>;
  upsertPrivate(profileId: string, organizationId: string, patch: Partial<ProfilePrivate>): Promise<void>;
}

/** Write + read access to pending organization invitations. */
export interface InvitationRepository {
  createInvitation(organizationId: string, email: string, role: Role, fullName?: string): Promise<void>;
  listPendingInvitations(organizationId: string): Promise<Invitation[]>;
  findPendingInvitation(organizationId: string, email: string): Promise<Invitation | null>;
  revokeInvitation(invitationId: string): Promise<void>;
}

/**
 * Mirrors the Supabase `tech_service_areas` table
 * (`app/supabase/0020_field_ops_segway_and_estimating.sql`). Snake_case wire
 * shape consumed by `domain/segway-candidates.ts`'s `candidatesFor` after
 * mapping through `toTechServiceArea`.
 */
export interface TechServiceAreaRow {
  id: string;
  organization_id: string;
  tech_id: string;
  service_area_id: string;
  created_at: string;
}

/** Domain (camelCase) shape of one `tech_service_areas` row. */
export interface TechServiceArea {
  id: string;
  organizationId: string;
  techId: string;
  serviceAreaId: string;
  createdAt: string;
}

/** Maps a `tech_service_areas` row to its domain shape. Pure, no validation needed — every column is already well-typed at the wire boundary, same as `toAuditLogEntry`. */
export function toTechServiceArea(row: TechServiceAreaRow): TechServiceArea {
  return {
    id: row.id,
    organizationId: row.organization_id,
    techId: row.tech_id,
    serviceAreaId: row.service_area_id,
    createdAt: row.created_at,
  };
}

export interface TimeEntryRow {
  id: string;
  organization_id: string;
  job_id: string;
  tech_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  organizationId: string;
  jobId: string;
  techId: string;
  clockInAt: string;
  clockOutAt: string | null;
  createdAt: string;
}

export function toTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobId: row.job_id,
    techId: row.tech_id,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    createdAt: row.created_at,
  };
}

/**
 * Employee-scoped read access to job_time_entries for the admin roster's
 * hours-worked display. Distinct from field-tech's TimeEntryRepository
 * (clockIn/clockOut/listForJob, session-scoped to the acting tech) — this
 * interface is read-only and scoped by employee/profile id, for an org
 * admin viewing any tech's cumulative hours. RLS's job_time_entries_admin_all
 * policy already grants org admins full read access to every row in their
 * organization, so no new migration is required.
 */
export interface TimeEntryRepository {
  listForEmployee(profileId: string): Promise<TimeEntry[]>;
}

/**
 * Read + coverage-write access to tech service-area assignments. Feeds
 * `domain/segway-candidates.ts`'s `candidatesFor` for the assignment
 * board's coverage flag, and now also backs the employee-editor checkbox
 * UI's `assignToTech`/`removeFromTech` toggles.
 */
export interface TechServiceAreaRepository {
  listForOrganization(organizationId: string): Promise<TechServiceArea[]>;
  assignToTech(organizationId: string, techId: string, serviceAreaId: string): Promise<void>;
  removeFromTech(organizationId: string, techId: string, serviceAreaId: string): Promise<void>;
}

/**
 * Mirrors the Supabase `tech_skills` table
 * (`app/supabase/0031_employee_profile_fields.sql`). Snake_case wire shape of
 * `TechSkill`, mirroring `TechServiceAreaRow` above.
 */
export interface TechSkillRow {
  id: string;
  organization_id: string;
  tech_id: string;
  skill: string;
  created_at: string;
}

/** Domain (camelCase) shape of one `tech_skills` row. */
export interface TechSkill {
  id: string;
  organizationId: string;
  techId: string;
  skill: string;
  createdAt: string;
}

/** Maps a `tech_skills` row to its domain shape. Pure, no validation needed — mirrors `toTechServiceArea`. */
export function toTechSkill(row: TechSkillRow): TechSkill {
  return {
    id: row.id,
    organizationId: row.organization_id,
    techId: row.tech_id,
    skill: row.skill,
    createdAt: row.created_at,
  };
}

/**
 * Read + toggle-write access to tech skill assignments, backing the
 * employee-editor's Skills picker UI — same `listForOrganization` +
 * assign/remove toggle shape as `TechServiceAreaRepository`.
 */
export interface TechSkillRepository {
  listForOrganization(organizationId: string): Promise<TechSkill[]>;
  assignToTech(organizationId: string, techId: string, skill: string): Promise<void>;
  removeFromTech(organizationId: string, techId: string, skill: string): Promise<void>;
}

/**
 * Mirrors the Supabase `service_areas` table. Snake_case wire shape,
 * same convention as `TechServiceAreaRow`.
 */
export interface ServiceAreaRow {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
  zip_codes: string[] | null;
}

/** Domain (camelCase) shape of one `service_areas` row. */
export interface ServiceArea {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  zipCodes: string[];
}

/** Maps a `service_areas` row to its domain shape. Pure, no validation needed — every column is already well-typed at the wire boundary, same as `toTechServiceArea`. */
export function toServiceArea(row: ServiceAreaRow): ServiceArea {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    createdAt: row.created_at,
    zipCodes: row.zip_codes ?? [],
  };
}

/** Read-only access to the org's service areas. */
export interface ServiceAreaRepository {
  listForOrganization(organizationId: string): Promise<ServiceArea[]>;
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
  kind?: 'installer' | 'investigator';
}

/**
 * Write access to `job_assignments`. Creates assignments (kind `installer`
 * or `investigator`) and reads back the latest investigator tech for a job.
 */
export interface JobAssignmentRepository {
  create(organizationId: string, draft: JobAssignmentDraft): Promise<void>;
  getInvestigatorTechId(jobId: string): Promise<string | null>;
  listInvestigatorTechIds(jobIds: string[]): Promise<Record<string, string>>;
}

/* ------------------------------------------------------------------ *
 * Customer row (snake_case) → domain type (camelCase)
 * ------------------------------------------------------------------ */

/**
 * Mirrors the Supabase `customers` table. Snake_case wire shape of
 * `Customer`, same convention as `JobRow`.
 */
export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  organization_id: string;
  created_at: string;
}

/** Domain (camelCase) shape of one `customers` row. */
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  organizationId: string;
  createdAt: string;
}

/**
 * Map a `customers` row to the domain `Customer`. Pure, no validation
 * needed — every column is already well-typed at the wire boundary, same
 * as `toJob`'s non-status fields.
 */
export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    organizationId: row.organization_id,
    createdAt: row.created_at,
  };
}

/**
 * Fields needed to insert or patch a `customers` row. `id`/`organizationId`/
 * `createdAt` are implementation-assigned on `create`, same invariant as
 * `JobAssignmentDraft`.
 */
export type CustomerCreateInput = Pick<Customer, 'name' | 'phone' | 'email' | 'address'> & {
  organizationId: string;
};

/** Patch shape for `CustomerRepository.update` — same `Partial<Pick<...>>` convention as `JobSchedulingPatch`. */
export type CustomerPatch = Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'address'>>;

/** Read/write access to customers. */
export interface CustomerRepository {
  getById(id: string): Promise<Customer | null>;
  create(input: CustomerCreateInput): Promise<Customer>;
  update(id: string, patch: CustomerPatch): Promise<Customer>;
  /** Atomic: update the job's linked customer, or create one and link it to the job (RPC save_job_customer). */
  saveForJob(jobId: string, patch: CustomerPatch): Promise<Customer>;
}

/* ------------------------------------------------------------------ *
 * Commission port (P3h.4b — supporting close-out-job.ts's commission
 * write; not part of the original P3d.1 port list).
 * ------------------------------------------------------------------ */

/**
 * Write access to `commissions` (`app/supabase/0005_money.sql`). Insert-only —
 * a commission is immutable once written (`commissions_immutable_trg`); the
 * one correction path is voiding, which is a separate concern for a later
 * slice, not this port.
 *
 * `line` is the `CommissionLine` produced by `money/commission.ts`'s
 * `calculateCommission` — it already snapshots `priceSheetId` and
 * `compensationPolicyId` per `commissions_one_per_job_idx`/P3a.3's not-null,
 * on-delete-restrict snapshot columns. `closedByUserId` is passed separately
 * because it identifies WHO closed the job (`commissions.user_id`), not the
 * commission earner captured inside `CommissionLine` itself.
 */
export interface CommissionRepository {
  create(organizationId: string, line: CommissionLine, closedByUserId: string): Promise<void>;
  listForOrganization(organizationId: string): Promise<Commission[]>;
}

/* ------------------------------------------------------------------ *
 * Close-out failure port — tracks a job's close-out attempts that fail
 * at any stage (readiness, price sheet lookup, commission calc, or the
 * final write), so an admin can see and resolve stuck close-outs.
 * ------------------------------------------------------------------ */

export type CloseOutFailureStage =
  | 'not_ready' | 'blocked' | 'no_price_sheet' | 'commission_calc' | 'write';

export type CloseOutFailureStatus =
  | 'open' | 'retrying' | 'resolved_retry' | 'resolved_manual' | 'ignored';

/**
 * Mirrors a `close_out_failures` row. `stage`/`status` are `string`, not the
 * narrower unions, until `toCloseOutFailure` validates them.
 */
export interface CloseOutFailureRow {
  id: string;
  organization_id: string;
  job_id: string;
  stage: string;
  reason: string;
  status: string;
  attempts: number;
  last_attempted_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

/** Domain (camelCase) shape of one close-out failure. */
export interface CloseOutFailureRecord {
  id: string;
  organizationId: string;
  jobId: string;
  stage: CloseOutFailureStage;
  reason: string;
  status: CloseOutFailureStatus;
  attempts: number;
  lastAttemptedAt: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const CLOSE_OUT_FAILURE_STAGES: readonly CloseOutFailureStage[] = [
  'not_ready',
  'blocked',
  'no_price_sheet',
  'commission_calc',
  'write',
];

function isCloseOutFailureStage(value: string): value is CloseOutFailureStage {
  return (CLOSE_OUT_FAILURE_STAGES as readonly string[]).includes(value);
}

const CLOSE_OUT_FAILURE_STATUSES: readonly CloseOutFailureStatus[] = [
  'open',
  'retrying',
  'resolved_retry',
  'resolved_manual',
  'ignored',
];

function isCloseOutFailureStatus(value: string): value is CloseOutFailureStatus {
  return (CLOSE_OUT_FAILURE_STATUSES as readonly string[]).includes(value);
}

/**
 * Map a `close_out_failures` row to the domain `CloseOutFailureRecord`.
 * Throws on an unrecognized stage or status rather than widening the union
 * — fail closed, matching `toJob`'s and `toPayment`'s pattern above.
 */
export function toCloseOutFailure(row: CloseOutFailureRow): CloseOutFailureRecord {
  if (!isCloseOutFailureStage(row.stage)) {
    throw new Error(`Unknown stage "${row.stage}" on close-out failure ${row.id}`);
  }
  if (!isCloseOutFailureStatus(row.status)) {
    throw new Error(`Unknown status "${row.status}" on close-out failure ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobId: row.job_id,
    stage: row.stage,
    reason: row.reason,
    status: row.status,
    attempts: row.attempts,
    lastAttemptedAt: row.last_attempted_at,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Read/write access to close-out failures. */
export interface CloseOutFailureRepository {
  recordFailure(organizationId: string, jobId: string, stage: CloseOutFailureStage, reason: string): Promise<void>;
  recordAttempt(jobId: string): Promise<void>;
  resolve(jobId: string, resolution: 'resolved_retry' | 'resolved_manual', resolvedBy: string, note?: string): Promise<void>;
  listNeedingAttention(organizationId: string): Promise<CloseOutFailureRecord[]>;
}

/* ------------------------------------------------------------------ *
 * Close-out photo/notes ports (Rule 38 Slice 1 — supporting
 * `CloseOutReviewScreen`'s photos/notes props; thin wrappers over the
 * already-shipped `job_photos`/`job_notes` tables,
 * `app/supabase/0007_field_tech_tables.sql`).
 * ------------------------------------------------------------------ */

/** One close-out photo captured for a job. Mirrors `CloseOutReviewScreen.tsx`'s `CloseOutPhoto`. */
export interface CloseOutPhoto {
  id: string;
  uri: string;
}

/** Read/write access to a job's close-out photos. */
export interface JobPhotoRepository {
  listForJob(jobId: string): Promise<CloseOutPhoto[]>;
  add(jobId: string, uri: string): Promise<CloseOutPhoto>;
  remove(photoId: string): Promise<void>;
}

/** Read/write access to a job's close-out notes. */
export interface JobNoteRepository {
  getForJob(jobId: string): Promise<string>;
  upsert(jobId: string, notes: string): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Job contact log port — itemized customer-contact history (phone/text/
 * email/other) per job, backed by the `job_contact_log` table
 * (`app/supabase/0052_job_contact_log.sql`).
 * ------------------------------------------------------------------ */

/**
 * Mirrors the Supabase `job_contact_log` table. Snake_case wire shape of
 * `JobContactLogEntry`, same convention as `JobRow`.
 */
export interface JobContactLogRow {
  id: number;
  organization_id: string;
  job_id: string;
  contact_type: string;
  note: string | null;
  contacted_by: string | null;
  created_at: string;
}

/** Domain (camelCase) shape of one `job_contact_log` row. */
export interface JobContactLogEntry {
  id: number;
  organizationId: string;
  jobId: string;
  contactType: 'phone' | 'text' | 'email' | 'other';
  note: string | null;
  contactedBy: string | null;
  createdAt: string;
}

/**
 * Read + create access to a job's itemized contact log. `create`'s
 * `contactedBy` is deliberately not a caller-supplied parameter — the
 * concrete implementation resolves it from the acting profile, same
 * invariant as `CalendarEventDraft.createdBy`.
 */
export interface JobContactLogRepository {
  listForJob(jobId: string): Promise<JobContactLogEntry[]>;
  create(
    jobId: string,
    organizationId: string,
    contactType: 'phone' | 'text' | 'email' | 'other',
    note: string | null,
  ): Promise<JobContactLogEntry>;
}

/* ------------------------------------------------------------------ *
 * Audit log port (P7 Slice B — read-only surface over the shipped
 * `audit_log` table; entries are written by `@jobcore/core`'s
 * `applyTransition` via `ctx.writeAudit`, never by this module).
 * ------------------------------------------------------------------ */

/**
 * Mirrors the Supabase `audit_log` table (`id`, `organization_id`,
 * `actor_id`, `action`, `entity`, `entity_id`, `metadata` jsonb,
 * `created_at`). `actor_id` is nullable because some rows are written by
 * system/background processes rather than an authenticated user.
 * `metadata` is untyped `Record<string, unknown>` at the row boundary —
 * its shape varies by `action` (see `state-machine.ts`'s
 * `job.transition.*` metadata shape as one example).
 */
export interface AuditLogRow {
  id: string;
  organization_id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Domain (camelCase) shape of one audit log row. */
export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Maps an `audit_log` row to its domain shape. Pure, no validation needed — every column is already well-typed at the wire boundary. */
export function toAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorId: row.actor_id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

/**
 * Optional narrowing filters for `AuditLogRepository.listForOrganization`.
 * All fields are AND-combined when present; an absent field applies no
 * filter on that dimension.
 */
export interface AuditLogFilter {
  entity?: string;
  entityId?: string;
  action?: string;
  /** Inclusive lower bound on `createdAt` (ISO 8601). */
  fromDate?: string;
  /** Inclusive upper bound on `createdAt` (ISO 8601). */
  toDate?: string;
}

/**
 * Read-only access to the audit log. Insert-only at the schema level —
 * this module never writes a row; writes are owned exclusively by
 * `@jobcore/core`'s `applyTransition` (`ctx.writeAudit`) and by
 * `apps/mobile/src/lib/field-tech-repos.ts`'s `writeAudit`.
 */
export interface AuditLogRepository {
  listForOrganization(organizationId: string, filter?: AuditLogFilter): Promise<AuditLogEntry[]>;
}

/* ------------------------------------------------------------------ *
 * Calendar event port (Workstream E — `calendar_events` table,
 * `app/supabase/0014_calendar_events.sql`). `writeAudit()` is confirmed
 * dead code (zero call sites), so calendar-event logging is an explicit
 * helper each transition call site invokes directly, not an optional
 * `Ctx.writeCalendarEvent?` hook on `applyTransition`.
 * ------------------------------------------------------------------ */

/**
 * Fields needed to insert one `calendar_events` row
 * (`app/supabase/0014_calendar_events.sql`: `id`, `organization_id`,
 * `job_id`, `kind`, `title`, `description`, `event_time`, `created_by`,
 * `created_at` — `id`/`created_at` are implementation-assigned, and
 * `created_by` is stamped from the authenticated caller, not passed here).
 */
export interface CalendarEventDraft {
  jobId: string | null;
  kind: string;
  title?: string | null;
  description?: string | null;
  eventTime: string;
}

/** Write access to `calendar_events`. Insert-only — no update/delete needed by this group. */
export interface CalendarEventRepository {
  create(organizationId: string, draft: CalendarEventDraft): Promise<void>;
  /**
   * Convenience wrapper over `create` for the common case: logging a job's
   * status transition as a `kind: 'status_change'` calendar event. The four
   * Workstream E call sites (`qualify-lead.ts`, `assign-job.ts`,
   * `close-out-job.ts`) use this rather than building the draft by hand.
   */
  logTransition(organizationId: string, jobId: string, fromStatus: JobStatus, toStatus: JobStatus): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Payments port (Workstream D — folded in from the retired
 * `payment-review` module's `modules/payment-review/src/data/ports.ts`.
 * Mirrors `payments` table, `app/supabase/0010_payment_review.sql:32-45`.
 * Replaces payment-review's raw prop-injected `SupabaseSelectClient` with
 * admin-finance's richer ports seam, consistent with every other
 * repository in this file.
 * ------------------------------------------------------------------ */

/**
 * Mirrors the Supabase `payments` table (`id`, `organization_id`, `job_id`,
 * `provider_id`, `amount`, `status`, `external_ref`, `confirmed_at`,
 * `confirmed_by`, `created_at`). `status` is `string`, not `PaymentStatus`
 * — it is untrusted wire data until `toPayment` validates it.
 */
export interface PaymentRow {
  id: string;
  organization_id: string;
  job_id: string;
  provider_id: string | null;
  amount: number;
  status: string;
  external_ref: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
}

/** The full `payments.status` union, restated as a runtime tuple so `toPayment` can validate an untrusted row. */
export const PAYMENT_STATUSES = ['pending', 'confirmed', 'failed', 'manual_confirmed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/** Statuses that satisfy a "payment settled" precondition (e.g. `hasPaymentRecord`). */
export const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = ['confirmed', 'manual_confirmed'];

/** Domain (camelCase) shape of one payment row. */
export interface Payment {
  id: string;
  organizationId: string;
  jobId: string;
  providerId: string | null;
  amount: number;
  status: PaymentStatus;
  externalRef: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  createdAt: string;
}

/**
 * Map a `payments` row to the domain `Payment`. Throws on an unrecognized
 * status rather than widening the union — fail closed, matching `toJob`'s
 * pattern above.
 */
export function toPayment(row: PaymentRow): Payment {
  if (!isPaymentStatus(row.status)) {
    throw new Error(`Unknown status "${row.status}" on payment ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobId: row.job_id,
    providerId: row.provider_id,
    amount: row.amount,
    status: row.status,
    externalRef: row.external_ref,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    createdAt: row.created_at,
  };
}

/**
 * Payments access for the merged Payments tab (listNeedingAttention /
 * listManuallyConfirmed / listForJob — ported from `payment-review`'s
 * `ReconciliationView.tsx`; needs-attention: `status in ('pending','failed')`;
 * manually-confirmed: `status = 'manual_confirmed'`), plus
 * `recordManualPayment`, the write path for the Job Details screen's manual
 * "Mark Paid" action. `provider_id` is always the `'manual'` sentinel and
 * `external_ref` stays null — this table may never hold a card number, PAN,
 * CVV, or any token that could be one.
 */
export interface PaymentsRepository {
  listNeedingAttention(organizationId: string): Promise<Payment[]>;
  listManuallyConfirmed(organizationId: string): Promise<Payment[]>;
  listForJob(jobId: string): Promise<Payment[]>;
  recordManualPayment(organizationId: string, jobId: string, amount: number): Promise<Payment>;
}

/* ------------------------------------------------------------------ *
 * Job planning ports (details + photos)
 * ------------------------------------------------------------------ */

export interface JobPlanningDetails {
  jobId: string;
  organizationId: string;
  modelNumbers: string | null;
  partsList: string | null;
  measurements: string | null;
  instructions: string | null;
  ingressNotes: string | null;
  logisticsNotes: string | null;
  parkingNotes: string | null;
  stateAssessment: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface JobPlanningDetailsInput {
  modelNumbers?: string | null;
  partsList?: string | null;
  measurements?: string | null;
  instructions?: string | null;
  ingressNotes?: string | null;
  logisticsNotes?: string | null;
  parkingNotes?: string | null;
  stateAssessment?: string | null;
}

export interface JobPlanningPhoto {
  id: string;
  jobId: string;
  organizationId: string;
  storagePath: string;
  caption: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface JobPlanningPhotoInput {
  storagePath: string;
  caption?: string | null;
}

export interface JobPlanningRepository {
  getForJob(jobId: string): Promise<JobPlanningDetails | null>;
  upsertForJob(jobId: string, details: JobPlanningDetailsInput): Promise<JobPlanningDetails>;
}

export interface JobPlanningPhotoRepository {
  listForJob(jobId: string): Promise<JobPlanningPhoto[]>;
  addForJob(jobId: string, photo: JobPlanningPhotoInput): Promise<JobPlanningPhoto>;
}

export type EstimateStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type EstimateLineItemKind = 'material' | 'labor' | 'other';

export interface JobEstimate {
  jobId: string;
  organizationId: string;
  status: EstimateStatus;
  summary: string | null;
  materialsNotes: string | null;
  laborNotes: string | null;
  materialsCost: number;
  laborCost: number;
  otherCost: number;
  totalCost: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  paymentTerms: string | null;
  depositAmount: number | null;
  customerNotes: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface JobEstimateInput {
  status?: EstimateStatus;
  summary?: string | null;
  materialsNotes?: string | null;
  laborNotes?: string | null;
  materialsCost?: number;
  laborCost?: number;
  otherCost?: number;
  totalCost?: number;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  paymentTerms?: string | null;
  depositAmount?: number | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
}

export interface JobEstimateLineItem {
  id: string;
  jobId: string;
  organizationId: string;
  kind: EstimateLineItemKind;
  description: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  createdAt: string;
  createdBy: string | null;
}

export interface JobEstimateLineItemDraft {
  kind: EstimateLineItemKind;
  description: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface EstimateRepository {
  getForJob(jobId: string): Promise<JobEstimate | null>;
  upsertForJob(jobId: string, input: JobEstimateInput): Promise<JobEstimate>;
  listLineItems(jobId: string): Promise<JobEstimateLineItem[]>;
  addLineItem(jobId: string, draft: JobEstimateLineItemDraft): Promise<JobEstimateLineItem>;
  updateLineItem(lineItemId: string, patch: Partial<JobEstimateLineItemDraft>): Promise<JobEstimateLineItem>;
  removeLineItem(lineItemId: string): Promise<void>;
  issueShareLink(jobId: string): Promise<{ token: string; url: string }>;
}

/* ------------------------------------------------------------------ *
 * Service task ports (Price Sheets task-pricing feature).
 * ------------------------------------------------------------------ */

/** One task belonging to a service, selectable when pricing a `PriceSheetRate`. */
export interface ServiceTask {
  id: string;
  organizationId: string;
  serviceId: string;
  name: string;
  estimatedMinutes?: number | null;
  rate?: number | null;
  category?: string | null;
  active?: boolean;
  priceCents?: number | null;
  details?: string | null;
  materials?: string | null;
  /** service_tasks.task_number (migration 0067); display via formatServiceTaskNumber. */
  taskNumber?: number | null;
}

export interface JobPlanTaskRow {
  id: string;
  jobId: string;
  serviceTaskId: string;
  quantity: number;
  notes: string | null;
  name: string;
  estimatedMinutes: number | null;
  rate: number | null;
  category: string | null;
  active: boolean;
}

export interface ServiceTaskCatalogEntry {
  id: string;
  name: string;
  category: string | null;
  estimatedMinutes: number | null;
  rate: number | null;
  taskNumber?: number | null;
}

export interface JobPlanTasksRepository {
  listCatalogTasks(organizationId: string): Promise<ServiceTaskCatalogEntry[]>;
  listForJob(jobId: string): Promise<JobPlanTaskRow[]>;
  addTask(jobId: string, serviceTaskId: string, quantity: number): Promise<JobPlanTaskRow>;
  updateQuantity(taskRowId: string, quantity: number): Promise<JobPlanTaskRow>;
  removeTask(taskRowId: string): Promise<void>;
  listServices(organizationId: string): Promise<Array<{ id: string; name: string }>>;
}

/**
 * Fields needed to create a new `ServiceTask`. `id` is server-assigned, same
 * convention as `PriceSheetDraft` above.
 */
export type ServiceTaskDraft = Omit<ServiceTask, 'id'>;

// Re-exported so callers of this module don't also need a direct import
// from `../money/types` just to name the status union.
export type { PriceSheetStatus };

/* ------------------------------------------------------------------ *
 * Job investigation port (Segway investigation dispatch —
 * `app/supabase/0023_field_ops_segway_and_estimating.sql`'s
 * `job_investigations` table). One evolving row per job, same
 * getForJob/upsertForJob shape as `JobPlanningRepository`; `0038_job_
 * investigations_unique_job.sql` adds the `job_id` unique constraint that
 * shape's `onConflict: 'job_id'` implementation relies on.
 * ------------------------------------------------------------------ */

export interface JobInvestigation {
  id: string;
  organizationId: string;
  jobId: string;
  techId: string;
  ingressNotes: string | null;
  logisticsNotes: string | null;
  parkingNotes: string | null;
  stateAssessment: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobInvestigationRepository {
  getForJob(jobId: string): Promise<JobInvestigation | null>;
  upsertForJob(jobId: string, patch: Partial<JobInvestigation>): Promise<JobInvestigation>;
}

/* ------------------------------------------------------------------ *
 * Time segment correction admin queue (job-time-segments-unified-time-
 * tracking-conditional plan, Step 8 -- job_time_segment_corrections,
 * migrations 0055-0058). Mirrors the reimbursements approve/reject
 * pattern (human review required), NOT time-off's auto-decide pattern.
 *
 * TimeSegmentReasonCode, TimeSegmentCorrectionStatus, and
 * TimeSegmentCorrection below are defined locally rather than
 * imported from field-tech because, as of this writing, field-tech's
 * ports.ts has not yet been updated with the plan's Step 2-7
 * TimeSegment* types (migrations 0055-0058 are also not yet applied).
 * These are stand-ins matching the plan's literal shapes; once
 * field-tech lands the canonical versions, this module should import
 * from there instead and these local definitions should be removed.
 *
 * Do not reuse the string 'admin_correction' anywhere in this code --
 * it collides with an existing unrelated JobNoteKind value.
 * ------------------------------------------------------------------ */

export type TimeSegmentReasonCode = 'job_labor' | 'lunch' | 'materials' | 'prem_visit' | 'travel' | 'other';

export type TimeSegmentCorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface TimeSegmentCorrection {
  id: string;
  organizationId: string;
  segmentId: string;
  techId: string;
  status: TimeSegmentCorrectionStatus;
  requestedStartAt: string | null;
  requestedEndAt: string | null;
  requestedReasonCode: TimeSegmentReasonCode | null;
  note: string;
  reviewNote: string | null;
  createdAt: string;
}

/**
 * Admin review queue for job_time_segment_corrections
 * (0056_job_time_segment_corrections.sql). approve / reject call the
 * security-definer RPCs from 0058 (approve_time_segment_correction,
 * reject_time_segment_correction), which set reviewed_by/reviewed_at
 * server-side. Unlike ReimbursementRepo, these methods resolve with
 * the updated record or reject the promise on failure -- there is no
 * {ok, ...} result wrapper for this port.
 */
export interface TimeSegmentCorrectionAdminRepository {
  listForOrganization(organizationId: string): Promise<TimeSegmentCorrection[]>;
  approve(correctionId: string): Promise<TimeSegmentCorrection>;
  reject(correctionId: string, reason: string): Promise<TimeSegmentCorrection>;
}
