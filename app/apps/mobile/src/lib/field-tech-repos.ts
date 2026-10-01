/**
 * Supabase-backed repository implementations for the field-tech module's
 * data ports (P4.S2.1).
 *
 * `modules/field-tech/src/data/ports.ts` declares interfaces only — no
 * sqlite, no fetch, no Supabase. This file is the host-side (apps/mobile)
 * concrete implementation the host injects via
 * `modules/field-tech/src/lib/module-ports.ts`'s `setModulePorts`. This is
 * not a general framework for other modules — field-tech's ports only.
 *
 * Uses the shared `supabase` client from `apps/mobile/src/lib/supabase.ts`
 * (chunked SecureStore-backed auth session), matching the client-access
 * pattern already established elsewhere in the app.
 */

import * as ImagePicker from 'expo-image-picker';
import { supabase, supabaseUrl } from './supabase';
import { enqueue } from './offline-db';
import { logSyncFailure } from './log';
import { makeIdempotencyKey } from '@jobcore/core';
import type { NewQueuedMutation } from '@jobcore/core';
import type {
  ChecklistRepository,
  ChecklistTemplate,
  ChecklistTemplateRow,
  ChecklistInstance,
  ChecklistInstanceRow,
  ChecklistInstanceKind,
  ChecklistItem,
  ChecklistItemRow,
  ChecklistItemAnswerDraft,
  JobPhotoRepository,
  JobPhoto,
  JobPhotoRow,
  JobPhotoDraft,
  TimeOffRepository,
  TimeOffRequest,
  TimeOffRequestRow,
  TimeOffRequestDraft,
  ReimbursementRequestRepository,
  ReimbursementRequestRow,
  ReimbursementRequestDraft,
  ReimbursementRequest,
  JobNoteRepository,
  JobNote,
  JobNoteRow,
  JobNoteDraft,
  TechJobRepository,
  CalendarEventRepository,
  CalendarEventDraft,
  CameraRepository,
  PhotoCapture,
  EstimateRepository,
  JobEstimate,
  JobEstimateLineItem,
  JobEstimateLineItemDraft,
  JobEstimateInput,
  TimeEntryRepository,
  TimeEntry,
  TimeEntryRow,
  JobInvestigationRepository,
  JobInvestigationInput,
  PremQueueRepository,
  PremQueueItem,
} from '../../../../modules/field-tech/src/data/ports';
import type { ModulePorts } from '../../../../modules/field-tech/src/lib/module-ports';
import { getBoolPref, setBoolPref } from './local-prefs';
import { getModuleSession } from '../../../../modules/field-tech/src/lib/module-session';
import {
  toChecklistTemplate,
  toChecklistInstance,
  toChecklistItem,
  toJobPhoto,
  toTimeOffRequest,
  toReimbursementRequest,
  toJobNote,
  toJob,
  toTimeEntry,
} from '../../../../modules/field-tech/src/data/ports';

/**
 * Builds a nonce for `makeIdempotencyKey` without depending on a uuid
 * library. Mirrors `modules/field-tech/src/screens/StartChecklist.tsx`'s
 * identical helper for consistency across the two offline-queue call sites.
 */
function makeNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Durably captures a mutation to the local offline queue (`./offline-db`)
 * BEFORE the corresponding direct Supabase write is attempted — mirrors
 * `StartChecklist.tsx`'s `handleCaptureBeforePhoto` pattern (enqueue first,
 * then perform the direct write). `applyOptimistic` in `@jobcore/core`'s
 * `offline/apply.ts` is hard-typed to Job/JobStatus transitions and cannot
 * be used for these entity-creation writes (checklist/photo/time-off/note/
 * audit), so this queues via the offline module's generic primitives
 * (`makeIdempotencyKey`, `NewQueuedMutation`, `enqueue`) instead — the
 * "minimal correct wiring directly from the offline module's own API"
 * fallback. Exactly-once replay is guaranteed by `id`'s idempotency key
 * (see `packages/core/src/offline/replay.ts` lines 93-97), not by anything
 * here. This does not replace the direct write below: repository return
 * types carry server-assigned fields (id/organization_id/created_at) that
 * only the network round trip can produce, so the enqueue only guarantees
 * the mutation is never lost when that round trip fails offline.
 */
async function enqueueMutation(op: string, occurredAt: string, payload: unknown): Promise<void> {
  const mutation: NewQueuedMutation = {
    id: makeIdempotencyKey(op, occurredAt, makeNonce()),
    op,
    payload: JSON.stringify(payload),
    occurredAt,
  };
  await enqueue(mutation);
}

/* ------------------------------------------------------------------ *
 * audit_log sink
 * ------------------------------------------------------------------ */

/** Fields needed to insert one `audit_log` row. */
export interface AuditLogDraft {
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  details?: Record<string, unknown> | null;
}

/**
 * Inserts one `audit_log` row. Insert-only — no read/update surface needed
 * by this module.
 */
export async function writeAudit(draft: AuditLogDraft): Promise<void> {
  await enqueueMutation('audit_log.write', draft.occurredAt, draft);

  const { error } = await supabase.from('audit_log').insert({
    organization_id: draft.organizationId,
    actor_id: draft.actorId,
    action: draft.action,
    entity: draft.entityType,
    entity_id: draft.entityId,
    metadata: { occurredAt: draft.occurredAt, details: draft.details ?? null },
  });
  if (error) {
    logSyncFailure('field-tech-repos.writeAudit', error.message, { draft });
    throw new Error(`writeAudit failed: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * ChecklistRepository
 * ------------------------------------------------------------------ */

export function createChecklistRepository(): ChecklistRepository {
  return {
    async getTemplateForService(
      organizationId: string,
      serviceId: string,
    ): Promise<ChecklistTemplate | null> {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('service_id', serviceId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(`getTemplateForService failed: ${error.message}`);
      }
      return data ? toChecklistTemplate(data as ChecklistTemplateRow) : null;
    },

    async listTemplateItems(templateId: string): Promise<ChecklistItem[]> {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('template_id', templateId);
      if (error) {
        throw new Error(`listTemplateItems failed: ${error.message}`);
      }
      return ((data ?? []) as ChecklistItemRow[]).map(toChecklistItem);
    },

    async getInstanceForJob(
      jobId: string,
      kind: ChecklistInstanceKind,
    ): Promise<ChecklistInstance | null> {
      const { data, error } = await supabase
        .from('checklist_instances')
        .select('*')
        .eq('job_id', jobId)
        .eq('kind', kind)
        .maybeSingle();
      if (error) {
        throw new Error(`getInstanceForJob failed: ${error.message}`);
      }
      return data ? toChecklistInstance(data as ChecklistInstanceRow) : null;
    },

    async listInstanceItems(instanceId: string): Promise<ChecklistItem[]> {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('instance_id', instanceId);
      if (error) {
        throw new Error(`listInstanceItems failed: ${error.message}`);
      }
      return ((data ?? []) as ChecklistItemRow[]).map(toChecklistItem);
    },

    async createInstance(
      organizationId: string,
      jobId: string,
      templateId: string,
      templateVersion: number,
      kind: ChecklistInstanceKind,
    ): Promise<ChecklistInstance> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('checklist_instance.create', occurredAt, {
        organizationId,
        jobId,
        templateId,
        templateVersion,
        kind,
      });

      const { data, error } = await supabase
        .from('checklist_instances')
        .insert({
          organization_id: organizationId,
          job_id: jobId,
          template_id: templateId,
          template_version: templateVersion,
          kind,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.createInstance', error.message, { organizationId, jobId, templateId });
        throw new Error(`createInstance failed: ${error.message}`);
      }
      return toChecklistInstance(data as ChecklistInstanceRow);
    },

    async submitInstance(
      instanceId: string,
      answers: ChecklistItemAnswerDraft[],
      submittedAt: string,
    ): Promise<ChecklistInstance> {
      const { data: instanceRow, error: instanceReadError } = await supabase
        .from('checklist_instances')
        .select('*')
        .eq('id', instanceId)
        .single();
      if (instanceReadError) {
        logSyncFailure('field-tech-repos.submitInstance', instanceReadError.message, { instanceId });
        throw new Error(`submitInstance failed to read instance: ${instanceReadError.message}`);
      }
      const organizationId = (instanceRow as ChecklistInstanceRow).organization_id;

      await enqueueMutation('checklist_instance.submit', submittedAt, {
        instanceId,
        answers,
        submittedAt,
      });

      if (answers.length > 0) {
        const { error: itemsError } = await supabase.from('checklist_items').insert(
          answers.map((answer) => ({
            organization_id: organizationId,
            instance_id: instanceId,
            template_id: null,
            label: answer.label,
            is_checked: answer.isChecked,
            value: answer.value,
            occurred_at: answer.occurredAt,
          })),
        );
        if (itemsError) {
          logSyncFailure('field-tech-repos.submitInstance', itemsError.message, { instanceId });
          throw new Error(`submitInstance failed to insert items: ${itemsError.message}`);
        }
      }

      const { data, error } = await supabase
        .from('checklist_instances')
        .update({ submitted_at: submittedAt })
        .eq('id', instanceId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.submitInstance', error.message, { instanceId });
        throw new Error(`submitInstance failed to update instance: ${error.message}`);
      }
      return toChecklistInstance(data as ChecklistInstanceRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobPhotoRepository
 * ------------------------------------------------------------------ */

export function createJobPhotoRepository(): JobPhotoRepository {
  return {
    async listForJob(jobId: string): Promise<JobPhoto[]> {
      const { data, error } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', jobId);
      if (error) {
        throw new Error(`listForJob failed: ${error.message}`);
      }
      return ((data ?? []) as JobPhotoRow[]).map(toJobPhoto);
    },

    async signedUrlFor(storagePath: string): Promise<string | null> {
      const { data, error } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(storagePath, 3600);
      if (error) return null;
      return data?.signedUrl ?? null;
    },

    async create(organizationId: string, draft: JobPhotoDraft): Promise<JobPhoto> {
      await enqueueMutation('job_photo.create', draft.occurredAt, { organizationId, ...draft });

      const { data, error } = await supabase
        .from('job_photos')
        .insert({
          organization_id: organizationId,
          job_id: draft.jobId,
          tech_id: draft.techId,
          kind: draft.kind,
          storage_path: draft.storagePath,
          occurred_at: draft.occurredAt,
          lat: draft.lat,
          lng: draft.lng,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.createJobPhoto', error.message, { organizationId, draft });
        throw new Error(`create job photo failed: ${error.message}`);
      }
      return toJobPhoto(data as JobPhotoRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * TimeOffRepository
 * ------------------------------------------------------------------ */

export function createTimeOffRepository(): TimeOffRepository {
  return {
    async listForTech(techId: string): Promise<TimeOffRequest[]> {
      const { data, error } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('tech_id', techId);
      if (error) {
        throw new Error(`listForTech failed: ${error.message}`);
      }
      return ((data ?? []) as TimeOffRequestRow[]).map(toTimeOffRequest);
    },

    async listForOrg(organizationId: string): Promise<TimeOffRequest[]> {
      const { data, error } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrg failed: ${error.message}`);
      }
      return ((data ?? []) as TimeOffRequestRow[]).map(toTimeOffRequest);
    },

    async create(
      organizationId: string,
      techId: string,
      draft: TimeOffRequestDraft,
    ): Promise<TimeOffRequest> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('time_off_request.create', occurredAt, { organizationId, techId, ...draft });

      const { data, error } = await supabase
        .from('time_off_requests')
        .insert({
          organization_id: organizationId,
          tech_id: techId,
          start_date: draft.startDate,
          end_date: draft.endDate,
          reason: draft.reason,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.createTimeOff', error.message, { organizationId, techId, draft });
        throw new Error(`create time off request failed: ${error.message}`);
      }
      return toTimeOffRequest(data as TimeOffRequestRow);
    },

    async cancel(requestId: string): Promise<void> {
      const { error } = await supabase.rpc('cancel_time_off_request', { p_request_id: requestId });
      if (error) {
        throw new Error(`cancel time off request failed: ${error.message}`);
      }
    },

    async update(requestId: string, draft: TimeOffRequestDraft): Promise<TimeOffRequest> {
      const { error } = await supabase.rpc('update_time_off_request', {
        p_request_id: requestId,
        p_start_date: draft.startDate,
        p_end_date: draft.endDate,
        p_reason: draft.reason ?? null,
      });
      if (error) {
        throw new Error(`update time off request failed: ${error.message}`);
      }

      const { data, error: selectError } = await supabase
        .from('time_off_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (selectError) {
        throw new Error(`update time off request failed: ${selectError.message}`);
      }
      return toTimeOffRequest(data as TimeOffRequestRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * ReimbursementRequestRepository
 * ------------------------------------------------------------------ */

export function createReimbursementRequestRepository(): ReimbursementRequestRepository {
  return {
    async listForTech(techId: string): Promise<ReimbursementRequest[]> {
      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('user_id', techId);
      if (error) {
        throw new Error(`listForTech failed: ${error.message}`);
      }
      return ((data ?? []) as ReimbursementRequestRow[]).map(toReimbursementRequest);
    },

    async create(
      organizationId: string,
      techId: string,
      draft: ReimbursementRequestDraft,
    ): Promise<ReimbursementRequest> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('reimbursement.create', occurredAt, { organizationId, techId, ...draft });

      const { data, error } = await supabase
        .from('reimbursements')
        .insert({
          organization_id: organizationId,
          user_id: techId,
          job_id: draft.jobId ?? null,
          amount_cents: draft.amountCents,
          description: draft.description ?? null,
          receipt_photo_path: draft.receiptPhotoPath ?? null,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.createReimbursement', error.message, { organizationId, techId, draft });
        throw new Error(`create reimbursement failed: ${error.message}`);
      }
      return toReimbursementRequest(data as ReimbursementRequestRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobNoteRepository
 * ------------------------------------------------------------------ */

export function createJobNoteRepository(): JobNoteRepository {
  return {
    async listForJob(jobId: string): Promise<JobNote[]> {
      const { data, error } = await supabase
        .from('job_notes')
        .select('*')
        .eq('job_id', jobId);
      if (error) {
        throw new Error(`listForJob failed: ${error.message}`);
      }
      return ((data ?? []) as JobNoteRow[]).map(toJobNote);
    },

    async create(organizationId: string, techId: string, draft: JobNoteDraft): Promise<JobNote> {
      await enqueueMutation('job_note.create', draft.occurredAt, { organizationId, techId, ...draft });

      const { data, error } = await supabase
        .from('job_notes')
        .insert({
          organization_id: organizationId,
          job_id: draft.jobId,
          tech_id: techId,
          kind: draft.kind,
          body: draft.body,
          occurred_at: draft.occurredAt,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.createJobNote', error.message, { organizationId, techId, draft });
        throw new Error(`create job note failed: ${error.message}`);
      }
      return toJobNote(data as JobNoteRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * TechJobRepository
 * ------------------------------------------------------------------ */

export function createTechJobRepository(): TechJobRepository {
  return {
    async listAssignedToTech(techId: string) {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, customers(name, phone), job_assignments!inner(tech_id)')
        .eq('job_assignments.tech_id', techId);
      if (error) {
        throw new Error(`listAssignedToTech failed: ${error.message}`);
      }
      return (data ?? []).map((row) => toJob(row as never));
    },

    async getById(jobId: string, techId: string) {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, customers(name, phone), job_assignments!inner(tech_id)')
        .eq('id', jobId)
        .eq('job_assignments.tech_id', techId)
        .maybeSingle();
      if (error) {
        throw new Error(`getById failed: ${error.message}`);
      }
      return data ? toJob(data as never) : null;
    },

    async updateStatusAsTech(jobId: string, techId: string, status) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job.updateStatusAsTech', occurredAt, { jobId, techId, status });

      const { data, error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', jobId)
        .eq('job_assignments.tech_id', techId)
        .select('*, job_assignments!inner(tech_id)')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.updateStatusAsTech', error.message, { jobId, techId, status });
        throw new Error(`updateStatusAsTech failed: ${error.message}`);
      }
      return toJob(data as never);
    },
  };
}

/* ------------------------------------------------------------------ *
 * CalendarEventRepository
 * ------------------------------------------------------------------ */

export function createCalendarEventRepository(): CalendarEventRepository {
  return {
    async create(organizationId: string, draft: CalendarEventDraft): Promise<void> {
      await enqueueMutation('calendar_event.create', draft.eventTime, { organizationId, ...draft });

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error(`create calendar event failed to resolve current user: ${userError?.message ?? 'no session'}`);
      }

      const { error } = await supabase.from('calendar_events').insert({
        organization_id: organizationId,
        job_id: draft.jobId,
        kind: draft.kind,
        title: draft.title ?? null,
        description: draft.description ?? null,
        event_time: draft.eventTime,
        created_by: userData.user.id,
      });
      if (error) {
        logSyncFailure('field-tech-repos.createCalendarEvent', error.message, { organizationId, draft });
        throw new Error(`create calendar event failed: ${error.message}`);
      }
    },

    async logOwnTransition(
      organizationId: string,
      jobId: string,
      fromStatus,
      toStatus,
    ): Promise<void> {
      await this.create(organizationId, {
        jobId,
        kind: 'status_change',
        title: `${fromStatus} -> ${toStatus}`,
        description: null,
        eventTime: new Date().toISOString(),
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * CameraRepository
 * ------------------------------------------------------------------ */

const JOB_PHOTOS_BUCKET = 'job-photos';

export function createCameraRepository(): CameraRepository {
  return {
    async capturePhoto(kind: 'before' | 'after'): Promise<PhotoCapture | null> {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (result.canceled) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset) {
        return null;
      }
      const path = `${kind}/${Date.now()}.jpg`;
      const blob = await (await fetch(asset.uri)).blob();

      const { error } = await supabase.storage
        .from(JOB_PHOTOS_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' });
      if (error) {
        logSyncFailure('field-tech-repos.capturePhoto', error.message, { kind, path });
        throw new Error(`capturePhoto upload failed: ${error.message}`);
      }

      return { storagePath: path, lat: null, lng: null };
    },
  };
}

/* ------------------------------------------------------------------ *
 * EstimateRepository
 * ------------------------------------------------------------------ */

/**
 * Resolves this module's ambient org/user context from the injected
 * `getModuleSession()` (`../../../../modules/field-tech/src/lib/module-session`)
 * — the host is the only legal source for field-tech's ambient org/user
 * context, per that module's own doc comment on the host-to-module read
 * direction. Fail-closed: throws if no session is injected yet, matching
 * this file's other functions' fail-fast convention for missing session/
 * auth state (see `createCalendarEventRepository`'s `supabase.auth.getUser()`
 * guard above).
 */
function requireModuleSession(): { organizationId: string; userId: string } {
  const session = getModuleSession();
  if (session === null) {
    throw new Error(
      'field-tech-repos: no module session injected — the host must call setModuleSession() before estimate writes.',
    );
  }
  return { organizationId: session.org.id, userId: session.userId };
}

/**
 * Duplicated from `admin-finance-repos.ts`'s identical mapper rather than
 * imported/shared — module isolation forbids field-tech from depending on
 * admin-finance's tree.
 */
function toJobEstimate(row: {
  job_id: string;
  organization_id: string;
  status: JobEstimate['status'];
  summary: string | null;
  materials_notes: string | null;
  labor_notes: string | null;
  materials_cost: string | number;
  labor_cost: string | number;
  other_cost: string | number;
  total_cost: string | number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  payment_terms: string | null;
  deposit_amount: string | number | null;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}): JobEstimate {
  return {
    jobId: row.job_id,
    organizationId: row.organization_id,
    status: row.status,
    summary: row.summary,
    materialsNotes: row.materials_notes,
    laborNotes: row.labor_notes,
    materialsCost: Number(row.materials_cost),
    laborCost: Number(row.labor_cost),
    otherCost: Number(row.other_cost),
    totalCost: Number(row.total_cost),
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    paymentTerms: row.payment_terms,
    depositAmount: row.deposit_amount === null ? null : Number(row.deposit_amount),
    customerNotes: row.customer_notes,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Duplicated from `admin-finance-repos.ts`'s identical mapper rather than
 * imported/shared — module isolation forbids field-tech from depending on
 * admin-finance's tree.
 */
function toJobEstimateLineItem(row: {
  id: string;
  job_id: string;
  organization_id: string;
  kind: JobEstimateLineItem['kind'];
  description: string;
  quantity: string | number;
  unit_cost: string | number;
  line_total: string | number;
  created_at: string;
  created_by: string | null;
}): JobEstimateLineItem {
  return {
    id: row.id,
    jobId: row.job_id,
    organizationId: row.organization_id,
    kind: row.kind,
    description: row.description,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    lineTotal: Number(row.line_total),
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export function createEstimateRepository(): EstimateRepository {
  return {
    async getForJob(jobId: string): Promise<JobEstimate | null> {
      const { organizationId } = requireModuleSession();
      const { data, error } = await supabase
        .from('job_estimates')
        .select('*')
        .eq('job_id', jobId)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) {
        throw new Error(`getForJob failed: ${error.message}`);
      }
      return data ? toJobEstimate(data as Parameters<typeof toJobEstimate>[0]) : null;
    },

    async upsertForJob(jobId: string, input: JobEstimateInput): Promise<JobEstimate> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_estimate.upsert', occurredAt, { jobId, input });

      const patch: Record<string, unknown> = {
        job_id: jobId,
        organization_id: organizationId,
        updated_by: userId,
      };
      if (input.status !== undefined) {
        patch.status = input.status;
      }
      if (input.summary !== undefined) {
        patch.summary = input.summary;
      }
      if (input.materialsNotes !== undefined) {
        patch.materials_notes = input.materialsNotes;
      }
      if (input.laborNotes !== undefined) {
        patch.labor_notes = input.laborNotes;
      }
      if (input.materialsCost !== undefined) {
        patch.materials_cost = input.materialsCost;
      }
      if (input.laborCost !== undefined) {
        patch.labor_cost = input.laborCost;
      }
      if (input.otherCost !== undefined) {
        patch.other_cost = input.otherCost;
      }
      if (input.totalCost !== undefined) {
        patch.total_cost = input.totalCost;
      }
      if (input.scheduledStart !== undefined) {
        patch.scheduled_start = input.scheduledStart;
      }
      if (input.scheduledEnd !== undefined) {
        patch.scheduled_end = input.scheduledEnd;
      }
      if (input.paymentTerms !== undefined) {
        patch.payment_terms = input.paymentTerms;
      }
      if (input.depositAmount !== undefined) {
        patch.deposit_amount = input.depositAmount;
      }
      if (input.customerNotes !== undefined) {
        patch.customer_notes = input.customerNotes;
      }
      if (input.internalNotes !== undefined) {
        patch.internal_notes = input.internalNotes;
      }

      const { data, error } = await supabase
        .from('job_estimates')
        .upsert(patch, { onConflict: 'job_id' })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.upsertJobEstimate', error.message, { jobId, input });
        throw new Error(`upsertForJob failed: ${error.message}`);
      }
      return toJobEstimate(data as Parameters<typeof toJobEstimate>[0]);
    },

    async listLineItems(jobId: string): Promise<JobEstimateLineItem[]> {
      const { organizationId } = requireModuleSession();
      const { data, error } = await supabase
        .from('job_estimate_line_items')
        .select('*')
        .eq('job_id', jobId)
        .eq('organization_id', organizationId)
        .order('kind', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) {
        throw new Error(`listLineItems failed: ${error.message}`);
      }
      return ((data ?? []) as Array<Parameters<typeof toJobEstimateLineItem>[0]>).map(toJobEstimateLineItem);
    },

    async addLineItem(jobId: string, draft: JobEstimateLineItemDraft): Promise<JobEstimateLineItem> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_estimate_line_item.add', occurredAt, { jobId, draft });

      const { data, error } = await supabase
        .from('job_estimate_line_items')
        .insert({
          job_id: jobId,
          organization_id: organizationId,
          kind: draft.kind,
          description: draft.description,
          quantity: draft.quantity,
          unit_cost: draft.unitCost,
          line_total: draft.lineTotal,
          created_by: userId,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.addJobEstimateLineItem', error.message, { jobId, draft });
        throw new Error(`addLineItem failed: ${error.message}`);
      }
      return toJobEstimateLineItem(data as Parameters<typeof toJobEstimateLineItem>[0]);
    },

    // No RLS policy backs a tech UPDATE on job_estimate_line_items — this
    // must fail loudly rather than silently no-op.
    async updateLineItem(
      _lineItemId: string,
      _patch: Partial<JobEstimateLineItemDraft>,
    ): Promise<JobEstimateLineItem> {
      throw new Error('Techs cannot edit estimate line items — remove and re-add is not permitted either; contact an admin.');
    },

    // No RLS policy backs a tech DELETE on job_estimate_line_items — this
    // must fail loudly rather than silently no-op.
    async removeLineItem(_lineItemId: string): Promise<void> {
      throw new Error('Techs cannot remove estimate line items; contact an admin.');
    },

    async issueShareLink(jobId: string): Promise<{ token: string; url: string }> {
      const { data, error } = await supabase.rpc('issue_estimate_token', { p_job_id: jobId });
      if (error) {
        throw new Error(`issueShareLink failed: ${error.message}`);
      }
      const token = data as string;
      return { token, url: `${supabaseUrl}/functions/v1/estimate-resolve?token=${token}` };
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobInvestigation (read-only, field-tech side)
 *
 * Mirrors `job_investigations` and the `JobInvestigation` shape defined in
 * `admin-finance-repos.ts`'s `createJobInvestigationRepository()`. Duplicated
 * locally rather than imported — module isolation forbids field-tech from
 * depending on admin-finance's tree (same rationale as `toJobEstimate` /
 * `toJobEstimateLineItem` above). Read-only here: field techs view
 * investigation data for jobs they're assigned to via `getJobInvestigation`,
 * matching this file's `EstimateRepository.getForJob` idiom (org-scoped via
 * `requireModuleSession()`, `.maybeSingle()`, throw on error). Not yet
 * declared in `ports.ts` — this shape is defined locally until a
 * `ModulePorts` slot is added there, same as `JobInvestigationRepository` on
 * the admin-finance side.
 * ------------------------------------------------------------------ */

export interface JobInvestigation {
  id: string;
  jobId: string;
  organizationId: string;
  techId: string;
  ingressNotes: string | null;
  logisticsNotes: string | null;
  parkingNotes: string | null;
  stateAssessment: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toJobInvestigation(row: {
  id: string;
  job_id: string;
  organization_id: string;
  tech_id: string;
  ingress_notes: string | null;
  logistics_notes: string | null;
  parking_notes: string | null;
  state_assessment: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}): JobInvestigation {
  return {
    id: row.id,
    jobId: row.job_id,
    organizationId: row.organization_id,
    techId: row.tech_id,
    ingressNotes: row.ingress_notes,
    logisticsNotes: row.logistics_notes,
    parkingNotes: row.parking_notes,
    stateAssessment: row.state_assessment,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getJobInvestigation(jobId: string): Promise<JobInvestigation | null> {
  const { organizationId } = requireModuleSession();
  const { data, error } = await supabase
    .from('job_investigations')
    .select('*')
    .eq('job_id', jobId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) {
    throw new Error(`getJobInvestigation failed: ${error.message}`);
  }
  return data ? toJobInvestigation(data as Parameters<typeof toJobInvestigation>[0]) : null;
}

export function createJobInvestigationRepository(): JobInvestigationRepository {
  return {
    async getForJob(jobId: string): Promise<JobInvestigation | null> {
      return getJobInvestigation(jobId);
    },

    async upsertForJob(jobId: string, patch: JobInvestigationInput): Promise<JobInvestigation> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_investigation.upsert', occurredAt, { jobId, patch });

      const { data, error } = await supabase
        .from('job_investigations')
        .upsert(
          {
            job_id: jobId,
            organization_id: organizationId,
            tech_id: userId,
            ingress_notes: patch.ingressNotes ?? null,
            logistics_notes: patch.logisticsNotes ?? null,
            parking_notes: patch.parkingNotes ?? null,
            state_assessment: patch.stateAssessment ?? null,
            submitted_at: patch.submittedAt ?? null,
            updated_at: occurredAt,
          },
          { onConflict: 'job_id' }
        )
        .select('*')
        .single();
      if (error) {
        logSyncFailure('field-tech-repos.upsertJobInvestigation', error.message, { jobId, patch });
        throw new Error(`upsertForJob failed: ${error.message}`);
      }
      return toJobInvestigation(data as Parameters<typeof toJobInvestigation>[0]);
    },
  };
}

/* ------------------------------------------------------------------ *
 * TimeEntryRepository
 * ------------------------------------------------------------------ */

export function createTimeEntryRepository(): TimeEntryRepository {
  return {
    async clockIn(jobId: string): Promise<TimeEntry> {
      const { organizationId, userId } = requireModuleSession();

      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_time_entry.clock_in', occurredAt, { jobId });

      const { data, error } = await supabase
        .from('job_time_entries')
        .insert({
          organization_id: organizationId,
          job_id: jobId,
          tech_id: userId,
          clock_in_at: occurredAt,
        })
        .select('*')
        .single();

      if (error) {
        logSyncFailure('field-tech-repos.clockIn', error.message, { jobId });
        throw new Error(`clockIn failed: ${error.message}`);
      }

      return toTimeEntry(data as TimeEntryRow);
    },

    async clockOut(entryId: string): Promise<TimeEntry> {
      const occurredAt = new Date().toISOString();

      await enqueueMutation('job_time_entry.clock_out', occurredAt, { entryId });

      const { data, error } = await supabase
        .from('job_time_entries')
        .update({ clock_out_at: occurredAt })
        .eq('id', entryId)
        .select('*')
        .single();

      if (error) {
        logSyncFailure('field-tech-repos.clockOut', error.message, { entryId });
        throw new Error(`clockOut failed: ${error.message}`);
      }

      return toTimeEntry(data as TimeEntryRow);
    },

    async listForJob(jobId: string): Promise<TimeEntry[]> {
      const { organizationId } = requireModuleSession();

      const { data, error } = await supabase
        .from('job_time_entries')
        .select('*')
        .eq('job_id', jobId)
        .eq('organization_id', organizationId)
        .order('clock_in_at', { ascending: true });

      if (error) {
        throw new Error(`listForJob failed: ${error.message}`);
      }

      return ((data ?? []) as TimeEntryRow[]).map(toTimeEntry);
    },
  };
}

/* ------------------------------------------------------------------ *
 * PremQueueRepository
 * ------------------------------------------------------------------ */

export function createPremQueueRepository(): PremQueueRepository {
  return {
    async listOpen(techId: string): Promise<{ items: PremQueueItem[]; unavailable: boolean }> {
      const { data: jobRows, error: jobsError } = await supabase
        .from('jobs')
        .select('*, customers(name, phone)')
        .not('needs_prem_at', 'is', null)
        .order('needs_prem_at', { ascending: true });
      if (jobsError) {
        if ((jobsError as { code?: string }).code === '42703') {
          return { items: [], unavailable: true };
        }
        throw jobsError;
      }
      const jobs = (jobRows ?? []).map((row) => toJob(row as never));
      const jobIds = jobs.map((job) => job.id);
      if (jobIds.length === 0) {
        return { items: [], unavailable: false };
      }

      const { data: assignmentRows, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('job_id, tech_id')
        .eq('kind', 'investigator')
        .in('job_id', jobIds);
      if (assignmentsError) throw assignmentsError;
      const claimedByJobId = new Map<string, string>();
      for (const row of assignmentRows ?? []) {
        claimedByJobId.set(row.job_id as string, row.tech_id as string);
      }

      const { data: investigationRows, error: investigationsError } = await supabase
        .from('job_investigations')
        .select('job_id, submitted_at')
        .eq('tech_id', techId)
        .in('job_id', jobIds);
      if (investigationsError) throw investigationsError;
      const mySubmittedJobIds = new Set(
        (investigationRows ?? [])
          .filter((row) => row.submitted_at != null)
          .map((row) => row.job_id as string)
      );

      const items: PremQueueItem[] = [];
      for (const job of jobs) {
        const claimedBy = claimedByJobId.get(job.id);
        if (claimedBy && claimedBy !== techId) continue;
        if (mySubmittedJobIds.has(job.id)) continue;
        items.push({
          job,
          customerName: job.customerName ?? null,
          customerPhone: job.customerPhone ?? null,
          claimedByMe: claimedBy === techId,
        });
      }
      return { items, unavailable: false };
    },

    async claim(organizationId: string, jobId: string, techId: string): Promise<void> {
      const { error } = await supabase.from('job_assignments').insert({
        organization_id: organizationId,
        job_id: jobId,
        tech_id: techId,
        kind: 'investigator',
      });
      if (error) throw error;
    },
  };
}

/* ------------------------------------------------------------------ *
 * ModulePorts aggregator
 * ------------------------------------------------------------------ */

export function buildFieldTechPorts(): ModulePorts {
  return {
    checklist: createChecklistRepository(),
    photos: createJobPhotoRepository(),
    timeOff: createTimeOffRepository(),
    notes: createJobNoteRepository(),
    reimbursements: createReimbursementRequestRepository(),
    jobs: createTechJobRepository(),
    calendarEvents: createCalendarEventRepository(),
    camera: createCameraRepository(),
    estimates: createEstimateRepository(),
    investigations: createJobInvestigationRepository(),
    timeEntries: createTimeEntryRepository(),
    premQueue: createPremQueueRepository(),
    localPrefs: { getBool: getBoolPref, setBool: setBoolPref },
    techs: {
      list: async (orgId: string) => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', orgId)
          .order('full_name');
        if (error) throw error;
        return (data ?? []).map((r: { id: string; full_name: string }) => ({ id: r.id, fullName: r.full_name }));
      },
    },
  };
}
