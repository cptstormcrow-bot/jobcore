/**
 * Data seam for the field-tech module (P4.S1.1).
 *
 * Interfaces only — NO implementation. This file declares the snake_case
 * wire shapes, the row→domain mappers, and the repository ports the module
 * depends on; the host application injects concrete implementations
 * (sqlite, Supabase fetch, fixtures, whatever) behind these interfaces.
 * No sqlite, no fetch, no fixtures, no React live here.
 *
 * Row shapes mirror `app/supabase/0007_field_tech_tables.sql` field-for-field.
 */

import type { Job, JobStatus } from '@jobcore/core';

/* ------------------------------------------------------------------ *
 * checklist_templates / checklist_instances / checklist_items
 * ------------------------------------------------------------------ */

/** Mirrors `checklist_templates`. */
export interface ChecklistTemplateRow {
  id: string;
  organization_id: string;
  service_id: string;
  version: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/** Domain shape of a checklist template. */
export interface ChecklistTemplate {
  id: string;
  organizationId: string;
  serviceId: string;
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function toChecklistTemplate(row: ChecklistTemplateRow): ChecklistTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    serviceId: row.service_id,
    version: row.version,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The full `ChecklistInstanceKind` union, restated as a runtime tuple so
 * `toChecklistInstance` can validate an untrusted row's `kind` string
 * against it. Mirrors `checklist_instances_kind_check` in the migration.
 */
export type ChecklistInstanceKind = 'start' | 'completion';

const CHECKLIST_INSTANCE_KINDS: readonly ChecklistInstanceKind[] = ['start', 'completion'];

function isChecklistInstanceKind(value: string): value is ChecklistInstanceKind {
  return (CHECKLIST_INSTANCE_KINDS as readonly string[]).includes(value);
}

/** Mirrors `checklist_instances`. `kind` is `string` — untrusted wire data until `toChecklistInstance` validates it. */
export interface ChecklistInstanceRow {
  id: string;
  organization_id: string;
  job_id: string;
  template_id: string;
  template_version: number;
  kind: string;
  submitted_at: string | null;
  created_at: string;
}

/** Domain shape of a checklist instance. */
export interface ChecklistInstance {
  id: string;
  organizationId: string;
  jobId: string;
  templateId: string;
  templateVersion: number;
  kind: ChecklistInstanceKind;
  submittedAt: string | null;
  createdAt: string;
}

/**
 * Map a `checklist_instances` row to the domain `ChecklistInstance`.
 * Throws on an unrecognized `kind` rather than widening the union — fail
 * closed instead of letting an unknown kind slip past callers that branch
 * on `'start' | 'completion'`.
 */
export function toChecklistInstance(row: ChecklistInstanceRow): ChecklistInstance {
  if (!isChecklistInstanceKind(row.kind)) {
    throw new Error(`Unknown checklist instance kind "${row.kind}" on instance ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobId: row.job_id,
    templateId: row.template_id,
    templateVersion: row.template_version,
    kind: row.kind,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
  };
}

/**
 * Mirrors `checklist_items`. Exactly one of `template_id`/`instance_id` is
 * populated (the migration's XOR check), never both and never neither —
 * this row shape mirrors the nullable-both-columns wire form as-is rather
 * than splitting into two row types, since the DB itself keeps one shape.
 */
export interface ChecklistItemRow {
  id: string;
  organization_id: string;
  template_id: string | null;
  instance_id: string | null;
  label: string;
  is_checked: boolean | null;
  value: string | null;
  occurred_at: string | null;
  created_at: string;
}

/** Domain shape of a checklist item. */
export interface ChecklistItem {
  id: string;
  organizationId: string;
  templateId: string | null;
  instanceId: string | null;
  label: string;
  isChecked: boolean | null;
  value: string | null;
  occurredAt: string | null;
  createdAt: string;
}

export function toChecklistItem(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    templateId: row.template_id,
    instanceId: row.instance_id,
    label: row.label,
    isChecked: row.is_checked,
    value: row.value,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

/** A single checklist item answer a tech submits against an instance. */
export interface ChecklistItemAnswerDraft {
  label: string;
  isChecked: boolean | null;
  value: string | null;
  occurredAt: string | null;
}

/**
 * Read + submit access to checklists. Templates are admin-authored
 * elsewhere (not this module's concern); this port reads templates only
 * so the mobile app can render what a checklist should contain, and
 * owns creating/submitting the tech's own instance + item answers.
 */
export interface ChecklistRepository {
  getTemplateForService(organizationId: string, serviceId: string): Promise<ChecklistTemplate | null>;
  listTemplateItems(templateId: string): Promise<ChecklistItem[]>;
  getInstanceForJob(jobId: string, kind: ChecklistInstanceKind): Promise<ChecklistInstance | null>;
  listInstanceItems(instanceId: string): Promise<ChecklistItem[]>;
  createInstance(
    organizationId: string,
    jobId: string,
    templateId: string,
    templateVersion: number,
    kind: ChecklistInstanceKind,
  ): Promise<ChecklistInstance>;
  submitInstance(
    instanceId: string,
    answers: ChecklistItemAnswerDraft[],
    submittedAt: string,
  ): Promise<ChecklistInstance>;
}

/* ------------------------------------------------------------------ *
 * job_photos
 * ------------------------------------------------------------------ */

/**
 * The full `JobPhotoKind` union, restated as a runtime tuple so
 * `toJobPhoto` can validate an untrusted row's `kind` string against it.
 * Mirrors `job_photos_kind_check` in the migration.
 */
export type JobPhotoKind = 'before' | 'after' | 'receipt' | 'damage';

const JOB_PHOTO_KINDS: readonly JobPhotoKind[] = ['before', 'after', 'receipt', 'damage'];

function isJobPhotoKind(value: string): value is JobPhotoKind {
  return (JOB_PHOTO_KINDS as readonly string[]).includes(value);
}

/** Mirrors `job_photos`. `kind` is `string` — untrusted wire data until `toJobPhoto` validates it. */
export interface JobPhotoRow {
  id: string;
  organization_id: string;
  job_id: string;
  tech_id: string;
  kind: string;
  storage_path: string;
  occurred_at: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

/** Domain shape of a job photo. */
export interface JobPhoto {
  id: string;
  organizationId: string;
  jobId: string;
  techId: string;
  kind: JobPhotoKind;
  storagePath: string;
  occurredAt: string;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

/**
 * Map a `job_photos` row to the domain `JobPhoto`.
 * Throws on an unrecognized `kind` rather than widening the union — an
 * unknown kind must fail closed, never degrade into an unchecked value.
 */
export function toJobPhoto(row: JobPhotoRow): JobPhoto {
  if (!isJobPhotoKind(row.kind)) {
    throw new Error(`Unknown job photo kind "${row.kind}" on photo ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobId: row.job_id,
    techId: row.tech_id,
    kind: row.kind,
    storagePath: row.storage_path,
    occurredAt: row.occurred_at,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
  };
}

/** Fields needed to insert one `job_photos` row (id/organization_id/created_at are implementation-assigned; idempotencyKey is client-generated for replay dedup). */
export interface JobPhotoDraft {
  jobId: string;
  techId: string;
  kind: JobPhotoKind;
  storagePath: string;
  occurredAt: string;
  lat: number | null;
  lng: number | null;
  idempotencyKey: string;
  id?: string;
  localUri?: string;
  ext?: string;
}

/** Read + insert access to job photos. Insert-only write — no update/delete needed by this module. */
export interface JobPhotoRepository {
  listForJob(jobId: string): Promise<JobPhoto[]>;
  create(organizationId: string, draft: JobPhotoDraft): Promise<JobPhoto>;
}

/** Result of a successful camera capture — the host-uploaded storage path plus optional geotag. */
export interface PhotoCapture {
  storagePath: string;
  lat: number | null;
  lng: number | null;
}

/**
 * Host-injected camera capture port. Lives in the host app (`apps/mobile`)
 * behind this interface because module-isolation forbids `expo-*` imports
 * under `modules/field-tech/src/**` — the module only ever sees this seam.
 */
export interface CameraRepository {
  /** Returns `null` if the user cancels the picker rather than completing a capture. */
  /**
   * Capture + copy to the local photo dir only; no upload here. The upload happens
   * inside the `job_photo.create` / `job_planning_photo.add` op handler.
   */
  capturePhoto(
    kind: 'before' | 'after',
    target: { jobId: string; photoId: string }
  ): Promise<{ storagePath: string; localUri: string; ext: string } | null>;
}

/* ------------------------------------------------------------------ *
 * time_off_requests
 * ------------------------------------------------------------------ */

/**
 * The full `TimeOffStatus` union, restated as a runtime tuple so
 * `toTimeOffRequest` can validate an untrusted row's `status` string
 * against it. Mirrors `time_off_requests_status_check`, as widened by `0019_time_off_auto_decide.sql` to include `'cancelled'`.
 */
export type TimeOffStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

const TIME_OFF_STATUSES: readonly TimeOffStatus[] = ['pending', 'approved', 'denied', 'cancelled'];

function isTimeOffStatus(value: string): value is TimeOffStatus {
  return (TIME_OFF_STATUSES as readonly string[]).includes(value);
}

/** Mirrors `time_off_requests`. `status` is `string` — untrusted wire data until `toTimeOffRequest` validates it. */
export interface TimeOffRequestRow {
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

/** Domain shape of a time off request. */
export interface TimeOffRequest {
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
 * Map a `time_off_requests` row to the domain `TimeOffRequest`.
 * Throws on an unrecognized `status` rather than widening the union —
 * fail closed instead of letting an unknown status slip past approve/deny
 * gating logic elsewhere.
 */
export function toTimeOffRequest(row: TimeOffRequestRow): TimeOffRequest {
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

export function isActiveTimeOffStatus(status: TimeOffStatus): boolean {
  return status === 'pending' || status === 'approved';
}

/** Fields needed to insert one `time_off_requests` row. `status` always starts `'pending'` (see migration comment), so it is not a caller-supplied field. */
export interface TimeOffRequestDraft {
  startDate: string;
  endDate: string;
  reason: string | null;
}

/**
 * Read + insert access to a tech's own time off requests. Deliberately has
 * NO status-write method — approve/deny is an org-admin concern enforced
 * by RLS, not this module's write surface.
 */
export interface TimeOffRepository {
  listForTech(techId: string): Promise<TimeOffRequest[]>;
  listForOrg(organizationId: string): Promise<TimeOffRequest[]>;
  create(organizationId: string, techId: string, draft: TimeOffRequestDraft): Promise<TimeOffRequest>;
  /** Cancels the caller's own existing time-off request, releasing the date. */
  cancel(requestId: string): Promise<void>;
  update(requestId: string, draft: TimeOffRequestDraft): Promise<TimeOffRequest>;
}

/* ------------------------------------------------------------------ *
 * job_notes
 * ------------------------------------------------------------------ */

/**
 * The full `JobNoteKind` union, restated as a runtime tuple so
 * `toJobNote` can validate an untrusted row's `kind` string against it.
 * Mirrors `job_notes_kind_check` in the migration; `completion_checklist` is
 * added to that constraint by migration 0101_completion_checklist_note_kind.sql.
 */
export type JobNoteKind =
  | 'decline_reason'
  | 'quality_notes'
  | 'dispute'
  | 'admin_correction'
  | 'completion_checklist';

const JOB_NOTE_KINDS: readonly JobNoteKind[] = [
  'decline_reason',
  'quality_notes',
  'dispute',
  'admin_correction',
  'completion_checklist',
];

function isJobNoteKind(value: string): value is JobNoteKind {
  return (JOB_NOTE_KINDS as readonly string[]).includes(value);
}

/** Mirrors `job_notes`. `kind` is `string` — untrusted wire data until `toJobNote` validates it. */
export interface JobNoteRow {
  id: string;
  organization_id: string;
  job_id: string;
  tech_id: string | null;
  kind: string;
  body: string;
  occurred_at: string;
  created_at: string;
}

/** Domain shape of a job note. */
export interface JobNote {
  id: string;
  organizationId: string;
  jobId: string;
  techId: string | null;
  kind: JobNoteKind;
  body: string;
  occurredAt: string;
  createdAt: string;
}

/**
 * Map a `job_notes` row to the domain `JobNote`.
 * Throws on an unrecognized `kind` rather than widening the union — fail
 * closed instead of letting an unknown note kind slip past UI branching.
 */
export function toJobNote(row: JobNoteRow): JobNote {
  if (!isJobNoteKind(row.kind)) {
    throw new Error(`Unknown job note kind "${row.kind}" on note ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobId: row.job_id,
    techId: row.tech_id,
    kind: row.kind,
    body: row.body,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

/** Fields needed to insert one `job_notes` row (id/organization_id/created_at are implementation-assigned; tech_id is stamped from the caller). */
export interface JobNoteDraft {
  jobId: string;
  kind: JobNoteKind;
  body: string;
  occurredAt: string;
}

/** Read + insert access to job notes. Insert-only write — no update/delete needed by this module. */
export interface JobNoteRepository {
  listForJob(jobId: string): Promise<JobNote[]>;
  create(organizationId: string, techId: string, draft: JobNoteDraft): Promise<JobNote>;
}

/* ------------------------------------------------------------------ *
 * Tech-scoped read-only job access
 * ------------------------------------------------------------------ */

/**
 * The full `JobStatus` union, restated as a runtime tuple so `toJob` can
 * validate an untrusted row's `status` string against it. Mirrors
 * `admin-finance/src/data/ports.ts`'s `JOB_STATUSES` — kept as a separate
 * local copy here rather than a shared export, matching that file's own
 * precedent of restating the tuple beside its row mapper.
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
  'archived',
];

function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

/** Mirrors the Supabase `jobs` table. Snake_case wire shape of `Job`. */
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
  is_beta?: boolean | null;
  needs_prem_at?: string | null;
  updated_at?: string | null;
  customers?: { name: string | null; phone: string | null } | null;
}

/**
 * Map a `jobs` row to the domain `Job`.
 * Throws on an unrecognized status rather than widening the union — an
 * unknown status must fail closed.
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
    customerName: row.customers?.name ?? null,
    customerPhone: row.customers?.phone ?? null,
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
    isBeta: row.is_beta === true,
    totalLaborSeconds: 0,
    needsPremAt: row.needs_prem_at ?? null,
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
  };
}

/**
 * Tech-scoped, read-only access to jobs — resolved through job_assignments
 * per the RLS policies in `0007_field_tech_tables.sql`'s comments (mirrors
 * `jobs_select_tech` in `0004_scheduling.sql`). No write methods: a tech
 * never patches a job row directly through this module; status/scheduling
 * writes remain `admin-finance`'s `JobRepository` concern.
 */
export interface TechJobRepository {
  listAssignedToTech(techId: string): Promise<Job[]>;
  getById(jobId: string, techId: string): Promise<Job | null>;
  /**
   * Persists the result of an in-memory `applyTransition`/`transitionJob`
   * call to `jobs.status` for a job the calling tech is assigned to
   * (cross-cutting fix — job status was computed but never written back).
   * Mirrors `admin-finance/src/data/ports.ts`'s `JobRepository.updateStatus`
   * — kept as a separate tech-scoped method rather than a shared export,
   * matching this file's own precedent (`JOB_STATUSES`/`toJob` above) of
   * restating admin-finance's shapes locally. Scoped by `techId` so the
   * implementation can enforce "only the assigned tech may move their own
   * job" the same way `getById` above already does.
   */
  updateStatusAsTech(jobId: string, techId: string, status: JobStatus): Promise<Job>;
}

export interface PremQueueItem {
  job: Job;
  customerName: string | null;
  customerPhone: string | null;
  claimedByMe: boolean;
  /** Task titles from job_task_summary_v (task_titles). */
  taskTitles?: string[];
}

export interface PremQueueRepository {
  listOpen(techId: string): Promise<{ items: PremQueueItem[]; unavailable: boolean }>;
  claim(organizationId: string, jobId: string, techId: string): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Calendar event port (Workstream E — `calendar_events` table,
 * `app/supabase/0014_calendar_events.sql`). Mirrors
 * `admin-finance/src/data/ports.ts`'s `CalendarEventRepository` —
 * `writeAudit()` is confirmed dead code (zero call sites), so calendar-
 * event logging is an explicit helper each transition call site invokes
 * directly, not an optional `Ctx.writeCalendarEvent?` hook.
 * ------------------------------------------------------------------ */

/**
 * Fields needed to insert one `calendar_events` row
 * (`app/supabase/0014_calendar_events.sql`) from a tech-facing call site.
 * `id`/`created_at` are implementation-assigned, and `created_by` is
 * stamped from the authenticated tech, not passed here.
 */
export interface CalendarEventDraft {
  jobId: string | null;
  kind: string;
  title?: string | null;
  description?: string | null;
  eventTime: string;
}

/** Write access to `calendar_events` from the field-tech module. Insert-only — no update/delete needed by this group. */
export interface CalendarEventRepository {
  create(organizationId: string, draft: CalendarEventDraft): Promise<void>;
  /**
   * Convenience wrapper over `create` for the common case: a tech logging
   * their own job's status transition as a `kind: 'status_change'`
   * calendar event, attributed to the calling tech.
   */
  logOwnTransition(organizationId: string, jobId: string, fromStatus: JobStatus, toStatus: JobStatus): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * reimbursements
 * ------------------------------------------------------------------ */

/**
 * `ReimbursementRequest*` here is a tech-submitted expense request against
 * `reimbursements` (migration 0005, own-or-admin RLS) — distinct from the
 * `Reimbursement { jobId, amount }` payroll rollup line, which is a computed
 * value, not a row a tech creates. Payroll logic lives in the `@jobcore/core`
 * wage-engine and the shared `@jobcore/payroll-ui` package. The `Request` suffix throughout this
 * block exists specifically to avoid colliding with that unrelated type.
 */

/**
 * The full `ReimbursementRequestStatus` union, restated as a runtime tuple
 * so `toReimbursementRequest` can validate an untrusted row's `status`
 * string against it. Mirrors `reimbursements_status_check` in the
 * migration.
 */
export type ReimbursementRequestStatus = 'pending' | 'approved' | 'rejected';

const REIMBURSEMENT_REQUEST_STATUSES: readonly ReimbursementRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
];

function isReimbursementRequestStatus(value: string): value is ReimbursementRequestStatus {
  return (REIMBURSEMENT_REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Mirrors `reimbursements`. `status` is `string` — untrusted wire data until `toReimbursementRequest` validates it. */
export interface ReimbursementRequestRow {
  id: string;
  organization_id: string;
  user_id: string;
  job_id: string | null;
  amount_cents: number;
  description: string | null;
  receipt_photo_path: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Domain shape of a reimbursement request. */
export interface ReimbursementRequest {
  id: string;
  organizationId: string;
  userId: string;
  jobId: string | null;
  amountCents: number;
  description: string | null;
  receiptPhotoPath: string | null;
  status: ReimbursementRequestStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map a `reimbursements` row to the domain `ReimbursementRequest`.
 * Throws on an unrecognized `status` rather than widening the union —
 * fail closed instead of letting an unknown status slip past approve/reject
 * gating logic elsewhere.
 */
export function toReimbursementRequest(row: ReimbursementRequestRow): ReimbursementRequest {
  if (!isReimbursementRequestStatus(row.status)) {
    throw new Error(`Unknown reimbursement request status "${row.status}" on request ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    jobId: row.job_id,
    amountCents: row.amount_cents,
    description: row.description,
    receiptPhotoPath: row.receipt_photo_path,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Fields needed to insert one `reimbursements` row. `status` always starts `'pending'` (see migration comment), so it is not a caller-supplied field. */
export interface ReimbursementRequestDraft {
  jobId?: string | null;
  amountCents: number;
  description?: string;
  receiptPhotoPath?: string;
}

/**
 * Read + insert access to a tech's own reimbursement requests. Deliberately
 * has NO status-write/approve/reject method — RLS gives non-admins
 * select+insert only on this table; admin-only UPDATE is a separate
 * module's concern.
 */
export interface ReimbursementRequestRepository {
  listForTech(techId: string): Promise<ReimbursementRequest[]>;
  create(organizationId: string, techId: string, draft: ReimbursementRequestDraft): Promise<ReimbursementRequest>;
}

export type EstimateStatus = 'draft' | 'submitted' | 'approved';
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
  materialsOnsite: boolean;
  trackingNumber: string | null;
  trackingStatus: string | null;
  trackingCheckedAt: string | null;
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
  materialsOnsite?: boolean;
  trackingNumber?: string | null;
  trackingStatus?: string | null;
  trackingCheckedAt?: string | null;
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
  /** Calls the ups-track edge function. */
  trackShipment(trackingNumber: string): Promise<{ ok: boolean; status: string | null; delivered: boolean; deliveredAt?: string | null; error?: string }>;
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
 * Clock-in/out access to job_time_entries. No organizationId/techId params
 * — resolves the caller's own org/user ambiently via requireModuleSession(),
 * mirroring EstimateRepository. RLS scopes writes to the tech's own rows
 * and their own assigned job.
 */
export interface TimeEntryRepository {
  clockIn(jobId: string): Promise<TimeEntry>;
  clockOut(entryId: string): Promise<TimeEntry>;
  listForJob(jobId: string): Promise<TimeEntry[]>;
}

/* ------------------------------------------------------------------ *
 * job_investigations (Segway investigation dispatch —
 * `app/supabase/0023_field_ops_segway_and_estimating.sql`'s
 * `job_investigations` table). Mirrors
 * `admin-finance/src/data/ports.ts`'s `JobInvestigation` type shape
 * field-for-field for consistency; this module's repository is scoped to
 * what `JobInvestigationScreen.tsx` actually calls (getForJob/upsertForJob).
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
  roomWork: Array<{ room: string; work: string; measurements?: string }>;
  measurements: string | null;
  techInstructions: string | null;
  materialsArrived: boolean | null;
  // The assigned Prem technician captures these red flags on the Prem Investigation report.
  redFlagMarginalEquipment: boolean; // marginal or failing equipment
  redFlagUndocumentedSystem: boolean; // complicated but undocumented existing system
  redFlagSubstandardStart: boolean; // substandard starting point; needs to be brought up to code
  redFlagNotes: string | null; // free-text notes
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Patch fields a tech may write via `upsertForJob` — the four note fields plus `submittedAt` for the submit action. */
export interface JobInvestigationInput {
  ingressNotes?: string | null;
  logisticsNotes?: string | null;
  parkingNotes?: string | null;
  stateAssessment?: string | null;
  roomWork?: Array<{ room: string; work: string; measurements?: string }>;
  measurements?: string | null;
  techInstructions?: string | null;
  materialsArrived?: boolean | null;
  redFlagMarginalEquipment?: boolean;
  redFlagUndocumentedSystem?: boolean;
  redFlagSubstandardStart?: boolean;
  redFlagNotes?: string | null;
  submittedAt?: string | null;
}

export interface JobInvestigationRepository {
  getForJob(jobId: string): Promise<JobInvestigation | null>;
  upsertForJob(jobId: string, patch: JobInvestigationInput): Promise<JobInvestigation>;
}

/** A job plan task as shown to a tech (read-only; mirrors `job_plan_tasks`). */
export interface JobPlanTaskSummary {
  id: string;
  title: string;
  kind: string;
  status: string;
  unit: string | null;
  area: string | null;
  materialsNote: string | null;
  /** ISO timestamp of the last content change. */
  contentUpdatedAt: string;
}

/** Job plan task read port. Ordered by `sort_order`. */
export interface JobPlanTaskRepository {
  listForJob(jobId: string): Promise<JobPlanTaskSummary[]>;
}

/** A planning photo attached to a job; `url` is a signed URL, null if signing failed. */
export interface JobPlanningPhoto {
  id: string;
  jobId: string;
  storagePath: string;
  caption: string | null;
  createdAt: string;
  url: string | null;
  jobPlanTaskId?: string | null;
}

/**
 * Planning-photo port. `add()` opens the image picker, resizes/compresses the
 * chosen image, uploads it, inserts the row, and returns the new photo —
 * or null if the user cancels the picker.
 */
export interface JobPlanningPhotoRepo {
  list(jobId: string): Promise<JobPlanningPhoto[]>;
  // Tags the photo to a prem task at insert; techs have no UPDATE policy so retagging is admin-only.
  add(jobId: string, opts?: { jobPlanTaskId?: string | null }): Promise<JobPlanningPhoto | null>;
  remove(photoId: string): Promise<void>;
}
