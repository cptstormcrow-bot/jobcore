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
export function toChecklistTemplate(row) {
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
const CHECKLIST_INSTANCE_KINDS = ['start', 'completion'];
function isChecklistInstanceKind(value) {
    return CHECKLIST_INSTANCE_KINDS.includes(value);
}
/**
 * Map a `checklist_instances` row to the domain `ChecklistInstance`.
 * Throws on an unrecognized `kind` rather than widening the union — fail
 * closed instead of letting an unknown kind slip past callers that branch
 * on `'start' | 'completion'`.
 */
export function toChecklistInstance(row) {
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
export function toChecklistItem(row) {
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
const JOB_PHOTO_KINDS = ['before', 'after', 'receipt', 'damage'];
function isJobPhotoKind(value) {
    return JOB_PHOTO_KINDS.includes(value);
}
/**
 * Map a `job_photos` row to the domain `JobPhoto`.
 * Throws on an unrecognized `kind` rather than widening the union — an
 * unknown kind must fail closed, never degrade into an unchecked value.
 */
export function toJobPhoto(row) {
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
const TIME_OFF_STATUSES = ['pending', 'approved', 'denied', 'cancelled'];
function isTimeOffStatus(value) {
    return TIME_OFF_STATUSES.includes(value);
}
/**
 * Map a `time_off_requests` row to the domain `TimeOffRequest`.
 * Throws on an unrecognized `status` rather than widening the union —
 * fail closed instead of letting an unknown status slip past approve/deny
 * gating logic elsewhere.
 */
export function toTimeOffRequest(row) {
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
export function isActiveTimeOffStatus(status) {
    return status === 'pending' || status === 'approved';
}
const JOB_NOTE_KINDS = [
    'decline_reason',
    'quality_notes',
    'dispute',
    'admin_correction',
];
function isJobNoteKind(value) {
    return JOB_NOTE_KINDS.includes(value);
}
/**
 * Map a `job_notes` row to the domain `JobNote`.
 * Throws on an unrecognized `kind` rather than widening the union — fail
 * closed instead of letting an unknown note kind slip past UI branching.
 */
export function toJobNote(row) {
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
const JOB_STATUSES = [
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
function isJobStatus(value) {
    return JOB_STATUSES.includes(value);
}
/**
 * Map a `jobs` row to the domain `Job`.
 * Throws on an unrecognized status rather than widening the union — an
 * unknown status must fail closed.
 */
export function toJob(row) {
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
        isBeta: false,
    };
}
const REIMBURSEMENT_REQUEST_STATUSES = [
    'pending',
    'approved',
    'rejected',
];
function isReimbursementRequestStatus(value) {
    return REIMBURSEMENT_REQUEST_STATUSES.includes(value);
}
/**
 * Map a `reimbursement_requests` row to the domain `ReimbursementRequest`.
 * Throws on an unrecognized `status` rather than widening the union —
 * fail closed instead of letting an unknown status slip past approve/reject
 * gating logic elsewhere.
 */
export function toReimbursementRequest(row) {
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
export function toTimeEntry(row) {
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
