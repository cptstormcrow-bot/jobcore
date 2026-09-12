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
export declare function toChecklistTemplate(row: ChecklistTemplateRow): ChecklistTemplate;
/**
 * The full `ChecklistInstanceKind` union, restated as a runtime tuple so
 * `toChecklistInstance` can validate an untrusted row's `kind` string
 * against it. Mirrors `checklist_instances_kind_check` in the migration.
 */
export type ChecklistInstanceKind = 'start' | 'completion';
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
export declare function toChecklistInstance(row: ChecklistInstanceRow): ChecklistInstance;
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
export declare function toChecklistItem(row: ChecklistItemRow): ChecklistItem;
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
    createInstance(organizationId: string, jobId: string, templateId: string, templateVersion: number, kind: ChecklistInstanceKind): Promise<ChecklistInstance>;
    submitInstance(instanceId: string, answers: ChecklistItemAnswerDraft[], submittedAt: string): Promise<ChecklistInstance>;
}
/**
 * The full `JobPhotoKind` union, restated as a runtime tuple so
 * `toJobPhoto` can validate an untrusted row's `kind` string against it.
 * Mirrors `job_photos_kind_check` in the migration.
 */
export type JobPhotoKind = 'before' | 'after' | 'receipt' | 'damage';
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
export declare function toJobPhoto(row: JobPhotoRow): JobPhoto;
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
    capturePhoto(kind: 'before' | 'after'): Promise<PhotoCapture | null>;
}
/**
 * The full `TimeOffStatus` union, restated as a runtime tuple so
 * `toTimeOffRequest` can validate an untrusted row's `status` string
 * against it. Mirrors `time_off_requests_status_check`, as widened by `0019_time_off_auto_decide.sql` to include `'cancelled'`.
 */
export type TimeOffStatus = 'pending' | 'approved' | 'denied' | 'cancelled';
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
export declare function toTimeOffRequest(row: TimeOffRequestRow): TimeOffRequest;
export declare function isActiveTimeOffStatus(status: TimeOffStatus): boolean;
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
    create(organizationId: string, techId: string, draft: TimeOffRequestDraft): Promise<TimeOffRequest>;
    /** Cancels the caller's own existing time-off request, releasing the date. */
    cancel(requestId: string): Promise<void>;
    update(requestId: string, draft: TimeOffRequestDraft): Promise<TimeOffRequest>;
}
/**
 * The full `JobNoteKind` union, restated as a runtime tuple so
 * `toJobNote` can validate an untrusted row's `kind` string against it.
 * Mirrors `job_notes_kind_check` in the migration.
 */
export type JobNoteKind = 'decline_reason' | 'quality_notes' | 'dispute' | 'admin_correction';
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
export declare function toJobNote(row: JobNoteRow): JobNote;
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
}
/**
 * Map a `jobs` row to the domain `Job`.
 * Throws on an unrecognized status rather than widening the union — an
 * unknown status must fail closed.
 */
export declare function toJob(row: JobRow): Job;
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
/**
 * `ReimbursementRequest*` here is a tech-submitted expense request against
 * `reimbursement_requests` — distinct from `@jobcore/core`'s `payroll.ts`
 * `Reimbursement { jobId, amount }`, which is a computed payroll rollup
 * line, not a row a tech creates. The `Request` suffix throughout this
 * block exists specifically to avoid colliding with that unrelated type.
 */
/**
 * The full `ReimbursementRequestStatus` union, restated as a runtime tuple
 * so `toReimbursementRequest` can validate an untrusted row's `status`
 * string against it. Mirrors `reimbursement_requests_status_check` in the
 * migration.
 */
export type ReimbursementRequestStatus = 'pending' | 'approved' | 'rejected';
/** Mirrors `reimbursement_requests`. `status` is `string` — untrusted wire data until `toReimbursementRequest` validates it. */
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
 * Map a `reimbursement_requests` row to the domain `ReimbursementRequest`.
 * Throws on an unrecognized `status` rather than widening the union —
 * fail closed instead of letting an unknown status slip past approve/reject
 * gating logic elsewhere.
 */
export declare function toReimbursementRequest(row: ReimbursementRequestRow): ReimbursementRequest;
/** Fields needed to insert one `reimbursement_requests` row. `status` always starts `'pending'` (see migration comment), so it is not a caller-supplied field. */
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
    issueShareLink(jobId: string): Promise<{
        token: string;
        url: string;
    }>;
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
export declare function toTimeEntry(row: TimeEntryRow): TimeEntry;
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
/** Patch fields a tech may write via `upsertForJob` — the four note fields plus `submittedAt` for the submit action. */
export interface JobInvestigationInput {
    ingressNotes?: string | null;
    logisticsNotes?: string | null;
    parkingNotes?: string | null;
    stateAssessment?: string | null;
    submittedAt?: string | null;
}
export interface JobInvestigationRepository {
    getForJob(jobId: string): Promise<JobInvestigation | null>;
    upsertForJob(jobId: string, patch: JobInvestigationInput): Promise<JobInvestigation>;
}
//# sourceMappingURL=ports.d.ts.map