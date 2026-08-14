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

import { supabase } from './supabase';
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
  JobNoteRepository,
  JobNote,
  JobNoteRow,
  JobNoteDraft,
  TechJobRepository,
} from '../../../../modules/field-tech/src/data/ports';
import type { ModulePorts } from '../../../../modules/field-tech/src/lib/module-ports';
import {
  toChecklistTemplate,
  toChecklistInstance,
  toChecklistItem,
  toJobPhoto,
  toTimeOffRequest,
  toJobNote,
  toJob,
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
        .select('*, job_assignments!inner(tech_id)')
        .eq('job_assignments.tech_id', techId);
      if (error) {
        throw new Error(`listAssignedToTech failed: ${error.message}`);
      }
      return (data ?? []).map((row) => toJob(row as never));
    },

    async getById(jobId: string, techId: string) {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, job_assignments!inner(tech_id)')
        .eq('id', jobId)
        .eq('job_assignments.tech_id', techId)
        .maybeSingle();
      if (error) {
        throw new Error(`getById failed: ${error.message}`);
      }
      return data ? toJob(data as never) : null;
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
    jobs: createTechJobRepository(),
  };
}
