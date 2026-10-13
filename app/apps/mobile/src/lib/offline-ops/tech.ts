// Tech (field-tech) replay handlers. Pure network functions: no SQLite, no React.
// Errors are never wrapped: the drain classifier reads .code/.status/.message.
import { registerOpHandlers, type OpContext, type OpHandler } from './index';

type Sb = OpContext['supabase'];
const APPLIED = { applied: true } as const;

function check(error: { message?: string } | null): void {
  if (error) throw error;
}

function isAlreadyExists(error: unknown): boolean {
  const e = error as { statusCode?: string | number; status?: number; message?: string } | null;
  if (!e) return false;
  const msg = String(e.message ?? '');
  return (
    String(e.statusCode ?? e.status ?? '') === '409' ||
    /already exists/i.test(msg) ||
    /duplicate/i.test(msg)
  );
}

const JOB_PHOTOS_BUCKET = 'job-photos';

async function uploadLocal(
  supabase: Sb,
  storagePath: string,
  localUri: string,
  contentType: string,
): Promise<void> {
  const blob = await (await fetch(localUri)).blob();
  const { error } = await supabase.storage
    .from(JOB_PHOTOS_BUCKET)
    .upload(storagePath, blob, { contentType });
  if (error && !isAlreadyExists(error)) throw error;
}

function contentTypeFor(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'heic') return 'image/heic';
  if (e === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export interface ChecklistInstanceCreatePayload {
  id: string;
  jobId: string;
  templateId: string;
  templateVersion: number;
  kind: string;
}
export interface ChecklistSubmitItem {
  id: string;
  label: string;
  is_checked: boolean;
  value: string | null;
  occurred_at: string;
}
export interface ChecklistInstanceSubmitPayload {
  instanceId: string;
  items: ChecklistSubmitItem[];
  submittedAt: string;
}
export interface JobPhotoCreatePayload {
  id: string;
  jobId: string;
  techId: string;
  kind: string;
  storagePath: string;
  localUri: string;
  ext: string;
  occurredAt: string;
  lat: number | null;
  lng: number | null;
}
export interface JobPhotoRemovePayload {
  id: string;
  storagePath?: string | null;
}
export interface JobPlanningPhotoAddPayload {
  id: string;
  jobId: string;
  storagePath: string;
  localUri: string;
  ext: string;
  contentType?: string;
}
export interface JobPlanningPhotoRemovePayload {
  id: string;
  storagePath?: string | null;
}
export interface JobNoteCreatePayload {
  id: string;
  jobId: string;
  techId: string;
  kind: string;
  body: string;
  occurredAt: string;
}
export interface TimeOffRequestCreatePayload {
  id: string;
  techId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
}
export interface TimeOffRequestCancelPayload {
  requestId: string;
}
export interface TimeOffRequestUpdatePayload {
  requestId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
}
export interface JobTimeEntryClockInPayload {
  id: string;
  jobId: string;
  clockInAt: string;
}
export interface JobTimeEntryClockOutPayload {
  id: string;
  clockOutAt: string;
}
export interface JobAssignmentClaimPayload {
  id?: string;
  jobId: string;
  techId: string;
}
export interface JobUpdateStatusAsTechPayload {
  jobId: string;
  status: string;
}
export interface JobPatchLifecyclePayload {
  jobId: string;
  patch: Record<string, unknown>;
}
export interface JobMarkContactedPayload {
  jobId: string;
  contactedAt: string;
}
export interface JobInvestigationUpsertPayload {
  jobId: string;
  occurredAt: string;
  patch: {
    ingressNotes?: string | null;
    logisticsNotes?: string | null;
    parkingNotes?: string | null;
    stateAssessment?: string | null;
    roomWork?: unknown[] | null;
    measurements?: unknown;
    techInstructions?: string | null;
    materialsArrived?: boolean | null;
    submittedAt?: string | null;
  };
}
export interface JobEstimateUpsertPayload {
  jobId: string;
  input: Record<string, unknown>;
}
export interface JobEstimateLineItemAddPayload {
  id: string;
  jobId: string;
  draft: {
    kind: string;
    description: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
    jobPlanTaskId?: string | null;
  };
}
export interface CalendarEventCreatePayload {
  id: string;
  jobId: string | null;
  kind: string;
  title?: string | null;
  description?: string | null;
  eventTime: string;
}
export interface ReimbursementCreatePayload {
  id: string;
  techId: string;
  jobId?: string | null;
  amountCents: number;
  description?: string | null;
  receiptPhotoPath?: string | null;
}
export interface AuditLogWritePayload {
  id?: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  details?: Record<string, unknown> | null;
}

// Estimate input field -> column (same set as the old upsertForJob).
const ESTIMATE_COLUMNS: Record<string, string> = {
  status: 'status',
  summary: 'summary',
  materialsNotes: 'materials_notes',
  laborNotes: 'labor_notes',
  materialsCost: 'materials_cost',
  laborCost: 'labor_cost',
  otherCost: 'other_cost',
  totalCost: 'total_cost',
  scheduledStart: 'scheduled_start',
  scheduledEnd: 'scheduled_end',
  paymentTerms: 'payment_terms',
  depositAmount: 'deposit_amount',
  customerNotes: 'customer_notes',
  internalNotes: 'internal_notes',
};

const checklistInstanceCreate: OpHandler<ChecklistInstanceCreatePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('checklist_instances').insert({
    id: p.id,
    organization_id: ctx.orgId,
    job_id: p.jobId,
    template_id: p.templateId,
    template_version: p.templateVersion,
    kind: p.kind,
  });
  check(error);
  return APPLIED;
};

const checklistInstanceSubmit: OpHandler<ChecklistInstanceSubmitPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.rpc('submit_checklist_instance', {
    p_instance_id: p.instanceId,
    p_items: p.items,
    p_submitted_at: p.submittedAt,
  });
  check(error);
  return APPLIED;
};

const jobPhotoCreate: OpHandler<JobPhotoCreatePayload> = async (p, ctx) => {
  await uploadLocal(ctx.supabase, p.storagePath, p.localUri, contentTypeFor(p.ext));
  const { error } = await ctx.supabase.from('job_photos').insert({
    id: p.id,
    organization_id: ctx.orgId,
    job_id: p.jobId,
    tech_id: p.techId,
    kind: p.kind,
    storage_path: p.storagePath,
    occurred_at: p.occurredAt,
    lat: p.lat,
    lng: p.lng,
  });
  check(error);
  return APPLIED;
};

const jobPhotoRemove: OpHandler<JobPhotoRemovePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('job_photos').delete().eq('id', p.id);
  check(error);
  if (p.storagePath) {
    await ctx.supabase.storage.from(JOB_PHOTOS_BUCKET).remove([p.storagePath]);
  }
  return APPLIED;
};

const jobPlanningPhotoAdd: OpHandler<JobPlanningPhotoAddPayload> = async (p, ctx) => {
  await uploadLocal(
    ctx.supabase,
    p.storagePath,
    p.localUri,
    p.contentType ?? contentTypeFor(p.ext),
  );
  const { error } = await ctx.supabase.from('job_planning_photos').insert({
    id: p.id,
    organization_id: ctx.orgId,
    job_id: p.jobId,
    storage_path: p.storagePath,
    created_by: ctx.userId,
  });
  check(error);
  return APPLIED;
};

const jobPlanningPhotoRemove: OpHandler<JobPlanningPhotoRemovePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('job_planning_photos').delete().eq('id', p.id);
  check(error);
  if (p.storagePath) {
    await ctx.supabase.storage.from(JOB_PHOTOS_BUCKET).remove([p.storagePath]);
  }
  return APPLIED;
};

const jobNoteCreate: OpHandler<JobNoteCreatePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('job_notes').insert({
    id: p.id,
    organization_id: ctx.orgId,
    job_id: p.jobId,
    tech_id: p.techId,
    kind: p.kind,
    body: p.body,
    occurred_at: p.occurredAt,
  });
  check(error);
  return APPLIED;
};

const timeOffRequestCreate: OpHandler<TimeOffRequestCreatePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('time_off_requests').insert({
    id: p.id,
    organization_id: ctx.orgId,
    tech_id: p.techId,
    start_date: p.startDate,
    end_date: p.endDate,
    reason: p.reason ?? null,
  });
  check(error);
  return APPLIED;
};

const timeOffRequestCancel: OpHandler<TimeOffRequestCancelPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.rpc('cancel_time_off_request', { p_request_id: p.requestId });
  check(error);
  return APPLIED;
};

const timeOffRequestUpdate: OpHandler<TimeOffRequestUpdatePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.rpc('update_time_off_request', {
    p_request_id: p.requestId,
    p_start_date: p.startDate,
    p_end_date: p.endDate,
    p_reason: p.reason ?? null,
  });
  check(error);
  return APPLIED;
};

const clockIn: OpHandler<JobTimeEntryClockInPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('job_time_entries').insert({
    id: p.id,
    organization_id: ctx.orgId,
    job_id: p.jobId,
    tech_id: ctx.userId,
    clock_in_at: p.clockInAt,
  });
  check(error);
  return APPLIED;
};

const clockOut: OpHandler<JobTimeEntryClockOutPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase
    .from('job_time_entries')
    .update({ clock_out_at: p.clockOutAt })
    .eq('id', p.id)
    .is('clock_out_at', null);
  check(error);
  return APPLIED;
};

const jobAssignmentClaim: OpHandler<JobAssignmentClaimPayload> = async (p, ctx) => {
  const row: Record<string, unknown> = {
    organization_id: ctx.orgId,
    job_id: p.jobId,
    tech_id: p.techId,
    kind: 'investigator',
  };
  if (p.id) row.id = p.id;
  const { error } = await ctx.supabase.from('job_assignments').insert(row);
  check(error);
  return APPLIED;
};

const jobUpdateStatusAsTech: OpHandler<JobUpdateStatusAsTechPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('jobs').update({ status: p.status }).eq('id', p.jobId);
  check(error);
  return APPLIED;
};

const jobPatchLifecycle: OpHandler<JobPatchLifecyclePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('jobs').update(p.patch).eq('id', p.jobId);
  check(error);
  return APPLIED;
};

const jobMarkContacted: OpHandler<JobMarkContactedPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase
    .from('jobs')
    .update({ contacted_at: p.contactedAt })
    .eq('id', p.jobId);
  check(error);
  return APPLIED;
};

const jobInvestigationUpsert: OpHandler<JobInvestigationUpsertPayload> = async (p, ctx) => {
  const patch = p.patch;
  const { error } = await ctx.supabase.from('job_investigations').upsert(
    {
      job_id: p.jobId,
      organization_id: ctx.orgId,
      tech_id: ctx.userId,
      ingress_notes: patch.ingressNotes ?? null,
      logistics_notes: patch.logisticsNotes ?? null,
      parking_notes: patch.parkingNotes ?? null,
      state_assessment: patch.stateAssessment ?? null,
      room_work: patch.roomWork ?? [],
      measurements: patch.measurements ?? null,
      tech_instructions: patch.techInstructions ?? null,
      materials_arrived: patch.materialsArrived ?? null,
      submitted_at: patch.submittedAt ?? null,
      updated_at: p.occurredAt,
    },
    { onConflict: 'job_id' },
  );
  check(error);
  return APPLIED;
};

const jobEstimateUpsert: OpHandler<JobEstimateUpsertPayload> = async (p, ctx) => {
  const row: Record<string, unknown> = {
    job_id: p.jobId,
    organization_id: ctx.orgId,
    updated_by: ctx.userId,
  };
  for (const [key, column] of Object.entries(ESTIMATE_COLUMNS)) {
    if (p.input[key] !== undefined) row[column] = p.input[key];
  }
  const { error } = await ctx.supabase.from('job_estimates').upsert(row, { onConflict: 'job_id' });
  check(error);
  return APPLIED;
};

const jobEstimateLineItemAdd: OpHandler<JobEstimateLineItemAddPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('job_estimate_line_items').insert({
    id: p.id,
    job_id: p.jobId,
    organization_id: ctx.orgId,
    kind: p.draft.kind,
    description: p.draft.description,
    quantity: p.draft.quantity,
    unit_cost: p.draft.unitCost,
    line_total: p.draft.lineTotal,
    job_plan_task_id: p.draft.jobPlanTaskId ?? null,
    created_by: ctx.userId,
  });
  check(error);
  return APPLIED;
};

const calendarEventCreate: OpHandler<CalendarEventCreatePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('calendar_events').insert({
    id: p.id,
    organization_id: ctx.orgId,
    job_id: p.jobId,
    kind: p.kind,
    title: p.title ?? null,
    description: p.description ?? null,
    event_time: p.eventTime,
    created_by: ctx.userId,
  });
  check(error);
  return APPLIED;
};

const reimbursementCreate: OpHandler<ReimbursementCreatePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('reimbursements').insert({
    id: p.id,
    organization_id: ctx.orgId,
    user_id: p.techId,
    job_id: p.jobId ?? null,
    amount_cents: p.amountCents,
    description: p.description ?? null,
    receipt_photo_path: p.receiptPhotoPath ?? null,
  });
  check(error);
  return APPLIED;
};

const auditLogWrite: OpHandler<AuditLogWritePayload> = async (p, ctx) => {
  const row: Record<string, unknown> = {
    organization_id: ctx.orgId,
    actor_id: p.actorId,
    action: p.action,
    entity: p.entityType,
    entity_id: p.entityId,
    metadata: { occurredAt: p.occurredAt, details: p.details ?? null },
  };
  // audit_log.id is a bigint identity: never send the client id; replay key is idempotency_key.
  if (p.id) row.idempotency_key = p.id;
  const { error } = await ctx.supabase.from('audit_log').insert(row);
  check(error);
  return APPLIED;
};

export const TECH_OP_HANDLERS: Record<string, OpHandler<any>> = {
  'checklist_instance.create': checklistInstanceCreate,
  'checklist_instance.submit': checklistInstanceSubmit,
  'job_photo.create': jobPhotoCreate,
  'job_photo.remove': jobPhotoRemove,
  'job_planning_photo.add': jobPlanningPhotoAdd,
  'job_planning_photo.remove': jobPlanningPhotoRemove,
  'job_note.create': jobNoteCreate,
  'time_off_request.create': timeOffRequestCreate,
  'time_off_request.cancel': timeOffRequestCancel,
  'time_off_request.update': timeOffRequestUpdate,
  'job_time_entry.clock_in': clockIn,
  'job_time_entry.clock_out': clockOut,
  'job_assignment.claim': jobAssignmentClaim,
  'job.updateStatusAsTech': jobUpdateStatusAsTech,
  'job.patch_lifecycle': jobPatchLifecycle,
  'job.mark_contacted': jobMarkContacted,
  'job_investigation.upsert': jobInvestigationUpsert,
  'job_estimate.upsert': jobEstimateUpsert,
  'job_estimate_line_item.add': jobEstimateLineItemAdd,
  'calendar_event.create': calendarEventCreate,
  'reimbursement.create': reimbursementCreate,
  'audit_log.write': auditLogWrite,
};

registerOpHandlers(TECH_OP_HANDLERS);
