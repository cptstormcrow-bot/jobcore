/**
 * Offline-queue op handlers: admin job / lead / customer domain (S9a).
 *
 * Pure network functions - the existing direct writes from admin-finance-repos.ts moved here
 * verbatim, minus the pre-write enqueue and the post-write row mapping. No SQLite, no React,
 * no imports from offline-db / read-cache / sync-* / repos files (cycle safety).
 *
 * Replay contract: errors are rethrown UNWRAPPED (the classifier reads .code/.status/.message);
 * a PK 23505 on a create is treated as "applied" by the drain, so it is never caught here;
 * updates are last-write-wins and 0 affected rows counts as applied; deletes are idempotent.
 */

import type {
  JobSchedulingPatch,
  JobDetailsPatch,
  JobLifecyclePatch,
  JobAssignmentDraft,
  CalendarEventDraft,
  CustomerCreateInput,
  CustomerPatch,
  LeadPatch,
  JobPlanningDetailsInput,
} from '../../../../../modules/admin-finance/src/data/ports';
import { toLeadRowPatch } from '../../../../../modules/admin-finance/src/data/ports';
import type { JobDraft } from '../../../../../modules/admin-finance/src/domain/qualify';
import type { NewLeadDraft } from '../../../../../modules/admin-finance/src/domain/intake-normalize';
import { registerOpHandlers, type OpHandler } from './index';

const APPLIED = { applied: true } as const;

/* ---------------------------- payload types ---------------------------- */

export interface JobCreatePayload { id: string; draft: JobDraft & { serviceAreaId?: string } }
export interface JobPatchSchedulingPayload { jobId: string; patch: JobSchedulingPatch }
export interface JobPatchLifecyclePayload { jobId: string; patch: JobLifecyclePatch }
export interface JobUpdateDetailsPayload { jobId: string; patch: JobDetailsPatch }
export interface JobUpdateStatusPayload { jobId: string; status: string }
export interface JobMarkBetaPayload { jobId: string; isBeta: boolean }
export interface JobSetNeedsPremPayload { jobId: string; at: string | null }
export interface JobMarkContactedPayload { jobId: string; contactedAt: string }
export interface JobResetTimelinePayload { jobId: string }

export interface JobAssignmentCreatePayload { id: string; organizationId: string; draft: JobAssignmentDraft }
export interface JobAssignmentRemoveInvestigatorPayload { jobId: string }
export interface JobAssignmentRemoveForJobPayload { jobId: string }

export interface LeadCreatePayload { id: string; draft: NewLeadDraft }
export interface LeadUpdatePayload { leadId: string; patch: LeadPatch }
export interface LeadMarkQualifiedPayload { leadId: string; jobId: string; qualifiedAt: string }

export interface CustomerCreatePayload { id: string; input: CustomerCreateInput }
export interface CustomerUpdatePayload { id: string; patch: CustomerPatch }
/** save_job_customer RPC (W0: IDEMPOTENT on replay). */
export interface JobCustomerSavePayload { jobId: string; patch: CustomerPatch }

export interface JobPlanTaskCreatePayload {
  id: string; organizationId: string; jobId: string; serviceTaskId: string; quantity: number;
}
export interface JobPlanTaskUpdateQuantityPayload { taskRowId: string; quantity: number; updatedAt: string }
export interface JobPlanTaskDeletePayload { taskRowId: string }

/** Table PK is serial; the client id lands in job_contact_log.client_id (0079, unique). */
export interface JobContactLogCreatePayload {
  id: string;
  jobId: string;
  organizationId: string;
  contactType: 'phone' | 'text' | 'email' | 'other';
  note: string | null;
}
export interface JobPlanningUpsertPayload { jobId: string; details: JobPlanningDetailsInput; updatedAt: string }
export interface JobNoteUpsertPayload { id: string; jobId: string; notes: string; occurredAt: string }
export interface CalendarEventCreatePayload { id: string; organizationId: string; draft: CalendarEventDraft }

/* ------------------------------- helpers ------------------------------- */

/** Camel-case CustomerPatch -> snake_case/DB columns (customers uses the same names; explicit map). */
export function customerPatchToRow(patch: CustomerPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.address !== undefined) row.address = patch.address;
  return row;
}

/* ------------------------------- handlers ------------------------------- */

const jobCreate: OpHandler<JobCreatePayload> = async ({ id, draft }, ctx) => {
  const { serviceAreaId, ...rest } = draft;
  const { error } = await ctx.supabase.from('jobs').insert({
    id,
    organization_id: rest.organizationId,
    status: rest.status,
    customer_id: rest.customerId,
    service_id: rest.serviceId,
    source: rest.source,
    payer: rest.payer,
    attach_timing: rest.attachTiming,
    requested_window: rest.requestedWindow,
    scheduled_start: rest.scheduledStart,
    scheduled_end: rest.scheduledEnd,
    address: rest.address,
    description: rest.description,
    house_age_years: rest.houseAgeYears ?? null,
    ingress_instructions: rest.ingressInstructions ?? null,
    assigned_tech_id: rest.assignedTechId,
    service_area_id: serviceAreaId,
    permit_status: rest.permitStatus,
    parking_available: rest.parkingAvailable,
    rooms: rest.rooms,
    panel_info: rest.panelInfo,
    considerations: rest.considerations,
  });
  if (error) throw error;
  return APPLIED;
};

const jobPatchScheduling: OpHandler<JobPatchSchedulingPayload> = async ({ jobId, patch }, ctx) => {
  const { error } = await ctx.supabase
    .from('jobs')
    .update({
      assigned_tech_id: patch.assignedTechId,
      scheduled_start: patch.scheduledStart,
      scheduled_end: patch.scheduledEnd,
      requested_window: patch.requestedWindow,
    })
    .eq('id', jobId)
    .select('id');
  if (error) throw error;
  return APPLIED;
};

const jobPatchLifecycle: OpHandler<JobPatchLifecyclePayload> = async ({ jobId, patch }, ctx) => {
  const update: Record<string, string | null> = {};
  if (patch.enRouteAt !== undefined) update.en_route_at = patch.enRouteAt;
  if (patch.inProgressAt !== undefined) update.in_progress_at = patch.inProgressAt;
  if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
  const { error } = await ctx.supabase.from('jobs').update(update).eq('id', jobId).select('id');
  if (error) throw error;
  return APPLIED;
};

const jobUpdateDetails: OpHandler<JobUpdateDetailsPayload> = async ({ jobId, patch }, ctx) => {
  const update: Record<string, unknown> = {
    address: patch.address,
    description: patch.description,
    house_age_years: patch.houseAgeYears,
    ingress_instructions: patch.ingressInstructions,
    scheduled_start: patch.scheduledStart,
    scheduled_end: patch.scheduledEnd,
    service_area_id: patch.serviceAreaId,
    permit_status: patch.permitStatus,
    parking_available: patch.parkingAvailable,
    rooms: patch.rooms,
    panel_info: patch.panelInfo,
    considerations: patch.considerations,
  };
  if (patch.customerId !== undefined) update.customer_id = patch.customerId;
  const { error } = await ctx.supabase.from('jobs').update(update).eq('id', jobId).select('id');
  if (error) throw error;
  return APPLIED;
};

const jobUpdateStatus: OpHandler<JobUpdateStatusPayload> = async ({ jobId, status }, ctx) => {
  const { error } = await ctx.supabase.from('jobs').update({ status }).eq('id', jobId).select('id');
  if (error) throw error;
  return APPLIED;
};

const jobMarkBeta: OpHandler<JobMarkBetaPayload> = async ({ jobId, isBeta }, ctx) => {
  const { error } = await ctx.supabase.from('jobs').update({ is_beta: isBeta }).eq('id', jobId);
  if (error) throw error;
  return APPLIED;
};

const jobSetNeedsPrem: OpHandler<JobSetNeedsPremPayload> = async ({ jobId, at }, ctx) => {
  const { error } = await ctx.supabase.from('jobs').update({ needs_prem_at: at }).eq('id', jobId);
  if (error) throw error;
  return APPLIED;
};

const jobMarkContacted: OpHandler<JobMarkContactedPayload> = async ({ jobId, contactedAt }, ctx) => {
  const { error } = await ctx.supabase.from('jobs').update({ contacted_at: contactedAt }).eq('id', jobId);
  if (error) throw error;
  return APPLIED;
};

const jobResetTimeline: OpHandler<JobResetTimelinePayload> = async ({ jobId }, ctx) => {
  const { error: jobErr } = await ctx.supabase
    .from('jobs')
    .update({ needs_prem_at: null, stage_marks: {}, contacted_at: null })
    .eq('id', jobId);
  if (jobErr) throw jobErr;
  const { error: invErr } = await ctx.supabase.from('job_investigations').delete().eq('job_id', jobId);
  if (invErr) throw invErr;
  const { error: asgErr } = await ctx.supabase
    .from('job_assignments')
    .delete()
    .eq('job_id', jobId)
    .eq('kind', 'investigator');
  if (asgErr) throw asgErr;
  return APPLIED;
};

const jobAssignmentCreate: OpHandler<JobAssignmentCreatePayload> = async ({ id, organizationId, draft }, ctx) => {
  // Investigator re-assignment: delete-then-insert (partial unique index 0065; keeps the 0035
  // time-off blackout trigger firing for the new assignee). Verbatim from the repo.
  const isInvestigator = draft.kind === 'investigator';
  let priorTechId: string | null = null;
  if (isInvestigator) {
    const { data: prior, error: priorErr } = await ctx.supabase
      .from('job_assignments')
      .select('tech_id, assigned_at')
      .eq('job_id', draft.jobId)
      .eq('kind', 'investigator')
      .order('assigned_at', { ascending: false })
      .limit(1);
    if (priorErr) throw priorErr;
    priorTechId = (prior?.[0]?.tech_id as string | undefined) ?? null;
    const { error: delError } = await ctx.supabase
      .from('job_assignments')
      .delete()
      .eq('job_id', draft.jobId)
      .eq('kind', 'investigator');
    if (delError) throw delError;
  }
  const { error } = await ctx.supabase.from('job_assignments').insert({
    id,
    organization_id: organizationId,
    job_id: draft.jobId,
    tech_id: draft.techId,
    assigned_at: draft.assignedAt,
    kind: draft.kind ?? 'installer',
  });
  if (error && isInvestigator && priorTechId && priorTechId !== draft.techId) {
    try {
      await ctx.supabase.from('job_assignments').insert({
        organization_id: organizationId,
        job_id: draft.jobId,
        tech_id: priorTechId,
        assigned_at: draft.assignedAt,
        kind: 'investigator',
      });
    } catch {
      // best-effort restore of the prior investigator; the original error is thrown below
    }
  }
  if (error) throw error;
  return APPLIED;
};

const jobAssignmentRemoveInvestigator: OpHandler<JobAssignmentRemoveInvestigatorPayload> = async ({ jobId }, ctx) => {
  const { error } = await ctx.supabase.from('job_assignments').delete().eq('job_id', jobId).eq('kind', 'investigator');
  if (error) throw error;
  return APPLIED;
};

const jobAssignmentRemoveForJob: OpHandler<JobAssignmentRemoveForJobPayload> = async ({ jobId }, ctx) => {
  const { error } = await ctx.supabase.from('job_assignments').delete().eq('job_id', jobId);
  if (error) throw error;
  return APPLIED;
};

const leadCreate: OpHandler<LeadCreatePayload> = async ({ id, draft }, ctx) => {
  const { error } = await ctx.supabase.from('leads').insert({
    id,
    organization_id: draft.organizationId,
    source_form: draft.sourceForm,
    name: draft.name,
    phone: draft.phone,
    email: draft.email,
    service: draft.service,
    preferred_date: draft.preferredDate,
    preferred_time: draft.preferredTime,
    address: draft.address,
    project_details: draft.projectDetails,
    source: draft.source,
    payer: draft.payer,
    attach_timing: draft.attachTiming,
  });
  if (error) throw error;
  return APPLIED;
};

const leadUpdate: OpHandler<LeadUpdatePayload> = async ({ leadId, patch }, ctx) => {
  const { error } = await ctx.supabase.from('leads').update(toLeadRowPatch(patch)).eq('id', leadId).select('id');
  if (error) throw error;
  return APPLIED;
};

const leadMarkQualified: OpHandler<LeadMarkQualifiedPayload> = async ({ leadId, jobId, qualifiedAt }, ctx) => {
  const { error } = await ctx.supabase
    .from('leads')
    .update({ qualified_at: qualifiedAt, converted_job_id: jobId })
    .eq('id', leadId)
    .select('id');
  if (error) throw error;
  return APPLIED;
};

const customerCreate: OpHandler<CustomerCreatePayload> = async ({ id, input }, ctx) => {
  const { error } = await ctx.supabase.from('customers').insert({
    id,
    organization_id: input.organizationId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    address: input.address,
  });
  if (error) throw error;
  return APPLIED;
};

const customerUpdate: OpHandler<CustomerUpdatePayload> = async ({ id, patch }, ctx) => {
  const { error } = await ctx.supabase.from('customers').update(customerPatchToRow(patch)).eq('id', id).select('id');
  if (error) throw error;
  return APPLIED;
};

const jobCustomerSave: OpHandler<JobCustomerSavePayload> = async ({ jobId, patch }, ctx) => {
  const { error } = await ctx.supabase.rpc('save_job_customer', {
    p_job_id: jobId,
    p_customer: patch,
  });
  if (error) throw error;
  return APPLIED;
};

const jobPlanTaskCreate: OpHandler<JobPlanTaskCreatePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('job_plan_tasks').insert({
    id: p.id,
    organization_id: p.organizationId,
    job_id: p.jobId,
    service_task_id: p.serviceTaskId,
    quantity: p.quantity,
  });
  if (error) throw error;
  return APPLIED;
};

const jobPlanTaskUpdateQuantity: OpHandler<JobPlanTaskUpdateQuantityPayload> = async (
  { taskRowId, quantity, updatedAt },
  ctx,
) => {
  const { error } = await ctx.supabase
    .from('job_plan_tasks')
    .update({ quantity, updated_at: updatedAt, updated_by: ctx.userId })
    .eq('id', taskRowId)
    .select('id');
  if (error) throw error;
  return APPLIED;
};

const jobPlanTaskDelete: OpHandler<JobPlanTaskDeletePayload> = async ({ taskRowId }, ctx) => {
  const { error } = await ctx.supabase.from('job_plan_tasks').delete().eq('id', taskRowId);
  if (error) throw error;
  return APPLIED;
};

const jobContactLogCreate: OpHandler<JobContactLogCreatePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('job_contact_log').insert({
    client_id: p.id,
    organization_id: p.organizationId,
    job_id: p.jobId,
    contact_type: p.contactType,
    note: p.note,
    contacted_by: ctx.userId,
  });
  if (error) throw error;
  return APPLIED;
};

const jobPlanningUpsert: OpHandler<JobPlanningUpsertPayload> = async ({ jobId, details, updatedAt }, ctx) => {
  const { error } = await ctx.supabase.from('job_planning_details').upsert(
    {
      job_id: jobId,
      organization_id: ctx.orgId,
      model_numbers: details.modelNumbers,
      parts_list: details.partsList,
      measurements: details.measurements,
      instructions: details.instructions,
      ingress_notes: details.ingressNotes,
      logistics_notes: details.logisticsNotes,
      parking_notes: details.parkingNotes,
      state_assessment: details.stateAssessment,
      updated_at: updatedAt,
      updated_by: ctx.userId,
    },
    { onConflict: 'job_id' },
  );
  if (error) throw error;
  return APPLIED;
};

const jobNoteUpsert: OpHandler<JobNoteUpsertPayload> = async ({ id, jobId, notes, occurredAt }, ctx) => {
  const { data: existing, error: selectError } = await ctx.supabase
    .from('job_notes')
    .select('id')
    .eq('job_id', jobId)
    .eq('kind', 'admin_correction')
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await ctx.supabase
      .from('job_notes')
      .update({ body: notes, occurred_at: occurredAt })
      .eq('id', (existing as { id: string }).id);
    if (error) throw error;
    return APPLIED;
  }

  const { error } = await ctx.supabase.from('job_notes').insert({
    id,
    organization_id: ctx.orgId,
    job_id: jobId,
    tech_id: ctx.userId,
    kind: 'admin_correction',
    body: notes,
    occurred_at: occurredAt,
  });
  if (error) throw error;
  return APPLIED;
};

const calendarEventCreate: OpHandler<CalendarEventCreatePayload> = async ({ id, organizationId, draft }, ctx) => {
  const { error } = await ctx.supabase.from('calendar_events').insert({
    id,
    organization_id: organizationId,
    job_id: draft.jobId,
    kind: draft.kind,
    title: draft.title ?? null,
    description: draft.description ?? null,
    event_time: draft.eventTime,
    created_by: ctx.userId,
  });
  if (error) throw error;
  return APPLIED;
};

export const ADMIN_JOBS_OP_HANDLERS = {
  'job.create': jobCreate,
  'job.patch_scheduling': jobPatchScheduling,
  'job.patch_lifecycle': jobPatchLifecycle,
  'job.update_details': jobUpdateDetails,
  'job.update_status': jobUpdateStatus,
  'job.mark_beta': jobMarkBeta,
  'job.set_needs_prem': jobSetNeedsPrem,
  'job.mark_contacted': jobMarkContacted,
  'job.reset_timeline': jobResetTimeline,
  'job_assignment.create': jobAssignmentCreate,
  'job_assignment.remove_investigator': jobAssignmentRemoveInvestigator,
  'job_assignment.remove_for_job': jobAssignmentRemoveForJob,
  'lead.create': leadCreate,
  'lead.update': leadUpdate,
  'lead.mark_qualified': leadMarkQualified,
  'customer.create': customerCreate,
  'customer.update': customerUpdate,
  'job_customer.save': jobCustomerSave,
  'job_plan_task.create': jobPlanTaskCreate,
  'job_plan_task.update_quantity': jobPlanTaskUpdateQuantity,
  'job_plan_task.delete': jobPlanTaskDelete,
  'job_contact_log.create': jobContactLogCreate,
  'job_planning.upsert': jobPlanningUpsert,
  'job_note.upsert': jobNoteUpsert,
  'calendar_event.create': calendarEventCreate,
} as const satisfies Record<string, OpHandler<any>>;

registerOpHandlers(ADMIN_JOBS_OP_HANDLERS);
