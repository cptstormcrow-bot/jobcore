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
import { createPayrollRepos, type PayrollRepoSession } from './payroll-repos';
import { newClientId } from './ids';
import { writeThrough, requireOnline } from './offline-mutations';
import { cachedRead, getReadCacheIdentity, buildReadCacheKey } from './read-cache';
import { copyToLocal, localPhotoPath, storagePathFor, planningStoragePathFor } from './photo-files';
import { resolvePhotoUri, setSignedUrlResolver } from './signed-url-cache';
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
  JobPlanTaskRepository,
  JobPlanTaskSummary,
  JobPlanningPhoto,
  JobPlanningPhotoRepo,
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
 * Cache-first read through the offline read cache (S6). Key = buildReadCacheKey(org, user,
 * queryName, params); falls back to the live fetch until the cache identity exists (pre-auth).
 */
async function readCached<T>(
  queryName: string,
  params: Record<string, unknown>,
  fetchLive: () => Promise<T>,
): Promise<T> {
  const id = getReadCacheIdentity();
  if (!id) return fetchLive();
  const key = buildReadCacheKey(id.orgId, id.userId, queryName, params);
  const { data } = await cachedRead(key, fetchLive);
  return data;
}

/** Rows last seen this session; used only to build optimistic values for write-through ops. */
const knownJobs = new Map<string, ReturnType<typeof toJob>>();
const knownInstances = new Map<string, ChecklistInstance>();
const knownEntries = new Map<string, TimeEntry>();
/** planning photo id -> storage path (job_planning_photo.remove must carry storagePath; no pre-read). */
const planningPathById = new Map<string, string>();

/** Supabase errors are plain objects; throw a real Error but keep code/details/hint/status. */
function asError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e && typeof e === 'object' && typeof (e as Record<string, any>).message === 'string') {
    const src = e as Record<string, any>;
    const err = new Error(src.message) as Error & Record<string, any>;
    for (const k of ['code', 'details', 'hint', 'status']) {
      if (src[k] !== undefined) err[k] = src[k];
    }
    return err;
  }
  return new Error(String(e));
}

function fileExt(path: string, fallback: string = 'jpg'): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(path);
  return m?.[1] ? m[1].toLowerCase() : fallback;
}

/** storagePath (.../<org>/<job>/<photoId>.<ext>) -> deterministic local file path, or null. */
function localPathForStorage(storagePath: string): string | null {
  const parts = storagePath.split('/');
  if (parts.length < 3) return null;
  const m = /^(.+)\.([A-Za-z0-9]+)$/.exec(parts[parts.length - 1] ?? '');
  if (!m) return null;
  return localPhotoPath(parts[parts.length - 3]!, parts[parts.length - 2]!, m[1]!, m[2]!);
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
  await writeThrough(
    'audit_log.write',
    {
      actorId: draft.actorId,
      action: draft.action,
      entityType: draft.entityType,
      entityId: draft.entityId,
      occurredAt: draft.occurredAt,
      details: draft.details ?? null,
    },
    draft.occurredAt,
    undefined,
  );
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
      return readCached('ft.checklist.getTemplateForService', { organizationId, serviceId }, async () => {
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
      });
    },

    async listTemplateItems(templateId: string): Promise<ChecklistItem[]> {
      return readCached('ft.checklist.listTemplateItems', { templateId }, async () => {
        const { data, error } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('template_id', templateId);
        if (error) {
          throw new Error(`listTemplateItems failed: ${error.message}`);
        }
        return ((data ?? []) as ChecklistItemRow[]).map(toChecklistItem);
      });
    },

    async getInstanceForJob(
      jobId: string,
      kind: ChecklistInstanceKind,
    ): Promise<ChecklistInstance | null> {
      const instance = await readCached('ft.checklist.getInstanceForJob', { jobId, kind }, async () => {
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
      });
      if (instance) knownInstances.set(instance.id, instance);
      return instance;
    },

    async listInstanceItems(instanceId: string): Promise<ChecklistItem[]> {
      return readCached('ft.checklist.listInstanceItems', { instanceId }, async () => {
        const { data, error } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('instance_id', instanceId);
        if (error) {
          throw new Error(`listInstanceItems failed: ${error.message}`);
        }
        return ((data ?? []) as ChecklistItemRow[]).map(toChecklistItem);
      });
    },

    async createInstance(
      organizationId: string,
      jobId: string,
      templateId: string,
      templateVersion: number,
      kind: ChecklistInstanceKind,
    ): Promise<ChecklistInstance> {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = toChecklistInstance({
        id,
        organization_id: organizationId,
        job_id: jobId,
        template_id: templateId,
        template_version: templateVersion,
        kind,
        submitted_at: null,
        created_at: occurredAt,
      } as never);
      const { data } = await writeThrough(
        'checklist_instance.create',
        { id, jobId, templateId, templateVersion, kind },
        occurredAt,
        optimistic,
      );
      knownInstances.set(data.id, data);
      return data;
    },

    async submitInstance(
      instanceId: string,
      answers: ChecklistItemAnswerDraft[],
      submittedAt: string,
    ): Promise<ChecklistInstance> {
      const known = knownInstances.get(instanceId);
      const optimistic: ChecklistInstance = known
        ? { ...known, submittedAt }
        : toChecklistInstance({
            id: instanceId,
            organization_id: requireModuleSession().organizationId,
            job_id: null,
            template_id: null,
            template_version: 0,
            kind: null,
            submitted_at: submittedAt,
            created_at: submittedAt,
          } as never);
      const items = answers.map((answer) => ({
        id: newClientId(),
        label: answer.label,
        is_checked: answer.isChecked,
        value: answer.value,
        occurred_at: answer.occurredAt,
      }));
      const { data } = await writeThrough(
        'checklist_instance.submit',
        { instanceId, items, submittedAt },
        submittedAt,
        optimistic,
      );
      knownInstances.set(instanceId, data);
      return data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobPhotoRepository
 * ------------------------------------------------------------------ */

export function createJobPhotoRepository(): JobPhotoRepository {
  return {
    async listForJob(jobId: string): Promise<JobPhoto[]> {
      return readCached('ft.photos.listForJob', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_photos')
          .select('*')
          .eq('job_id', jobId);
        if (error) {
          throw new Error(`listForJob failed: ${error.message}`);
        }
        return ((data ?? []) as JobPhotoRow[]).map(toJobPhoto);
      });
    },

    async create(organizationId: string, draft: JobPhotoDraft): Promise<JobPhoto> {
      // capturePhoto already copied the file locally; callers may pass id/localUri/ext alongside the draft.
      const extra = draft as JobPhotoDraft & { id?: string; localUri?: string; ext?: string };
      const id = extra.id ?? newClientId();
      const ext = extra.ext ?? fileExt(draft.storagePath);
      const localUri = extra.localUri ?? localPhotoPath(organizationId, draft.jobId, id, ext);
      const optimistic = toJobPhoto({
        id,
        organization_id: organizationId,
        job_id: draft.jobId,
        tech_id: draft.techId,
        kind: draft.kind,
        storage_path: draft.storagePath,
        occurred_at: draft.occurredAt,
        lat: draft.lat,
        lng: draft.lng,
        created_at: draft.occurredAt,
      } as never);
      const { data } = await writeThrough(
        'job_photo.create',
        {
          id,
          jobId: draft.jobId,
          techId: draft.techId,
          kind: draft.kind,
          storagePath: draft.storagePath,
          localUri,
          ext,
          occurredAt: draft.occurredAt,
          lat: draft.lat,
          lng: draft.lng,
        },
        draft.occurredAt,
        optimistic,
      );
      return data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * TimeOffRepository
 * ------------------------------------------------------------------ */

export function createTimeOffRepository(): TimeOffRepository {
  return {
    async listForTech(techId: string): Promise<TimeOffRequest[]> {
      return readCached('ft.timeOff.listForTech', { techId }, async () => {
        const { data, error } = await supabase
          .from('time_off_requests')
          .select('*')
          .eq('tech_id', techId);
        if (error) {
          throw new Error(`listForTech failed: ${error.message}`);
        }
        return ((data ?? []) as TimeOffRequestRow[]).map(toTimeOffRequest);
      });
    },

    async listForOrg(organizationId: string): Promise<TimeOffRequest[]> {
      return readCached('ft.timeOff.listForOrg', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('time_off_requests')
          .select('*')
          .eq('organization_id', organizationId);
        if (error) {
          throw new Error(`listForOrg failed: ${error.message}`);
        }
        return ((data ?? []) as TimeOffRequestRow[]).map(toTimeOffRequest);
      });
    },

    async create(
      organizationId: string,
      techId: string,
      draft: TimeOffRequestDraft,
    ): Promise<TimeOffRequest> {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = toTimeOffRequest({
        id,
        organization_id: organizationId,
        tech_id: techId,
        start_date: draft.startDate,
        end_date: draft.endDate,
        reason: draft.reason ?? null,
        status: 'pending',
        created_at: occurredAt,
        updated_at: occurredAt,
        created_by_admin_id: null,
      } as never);
      const { data } = await writeThrough(
        'time_off_request.create',
        { id, techId, startDate: draft.startDate, endDate: draft.endDate, reason: draft.reason ?? null },
        occurredAt,
        optimistic,
      );
      return data;
    },

    async cancel(requestId: string): Promise<void> {
      await writeThrough('time_off_request.cancel', { requestId }, new Date().toISOString(), undefined);
    },

    async update(requestId: string, draft: TimeOffRequestDraft): Promise<TimeOffRequest> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      const optimistic = toTimeOffRequest({
        id: requestId,
        organization_id: organizationId,
        tech_id: userId,
        start_date: draft.startDate,
        end_date: draft.endDate,
        reason: draft.reason ?? null,
        status: 'pending',
        created_at: occurredAt,
        updated_at: occurredAt,
        created_by_admin_id: null,
      } as never);
      const { data } = await writeThrough(
        'time_off_request.update',
        { requestId, startDate: draft.startDate, endDate: draft.endDate, reason: draft.reason ?? null },
        occurredAt,
        optimistic,
      );
      return data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * ReimbursementRequestRepository
 * ------------------------------------------------------------------ */

export function createReimbursementRequestRepository(): ReimbursementRequestRepository {
  return {
    async listForTech(techId: string): Promise<ReimbursementRequest[]> {
      return readCached('ft.reimbursements.listForTech', { techId }, async () => {
        const { data, error } = await supabase
          .from('reimbursements')
          .select('*')
          .eq('user_id', techId);
        if (error) {
          throw new Error(`listForTech failed: ${error.message}`);
        }
        return ((data ?? []) as ReimbursementRequestRow[]).map(toReimbursementRequest);
      });
    },

    async create(
      organizationId: string,
      techId: string,
      draft: ReimbursementRequestDraft,
    ): Promise<ReimbursementRequest> {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = toReimbursementRequest({
        id,
        organization_id: organizationId,
        user_id: techId,
        job_id: draft.jobId ?? null,
        amount_cents: draft.amountCents,
        description: draft.description ?? null,
        receipt_photo_path: draft.receiptPhotoPath ?? null,
        status: 'pending',
        created_at: occurredAt,
        updated_at: occurredAt,
      } as never);
      const { data } = await writeThrough(
        'reimbursement.create',
        {
          id,
          techId,
          jobId: draft.jobId ?? null,
          amountCents: draft.amountCents,
          description: draft.description ?? null,
          receiptPhotoPath: draft.receiptPhotoPath ?? null,
        },
        occurredAt,
        optimistic,
      );
      return data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobNoteRepository
 * ------------------------------------------------------------------ */

export function createJobNoteRepository(): JobNoteRepository {
  return {
    async listForJob(jobId: string): Promise<JobNote[]> {
      return readCached('ft.notes.listForJob', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_notes')
          .select('*')
          .eq('job_id', jobId);
        if (error) {
          throw new Error(`listForJob failed: ${error.message}`);
        }
        return ((data ?? []) as JobNoteRow[]).map(toJobNote);
      });
    },

    async create(organizationId: string, techId: string, draft: JobNoteDraft): Promise<JobNote> {
      const id = newClientId();
      const optimistic = toJobNote({
        id,
        organization_id: organizationId,
        job_id: draft.jobId,
        tech_id: techId,
        kind: draft.kind,
        body: draft.body,
        occurred_at: draft.occurredAt,
        created_at: draft.occurredAt,
      } as never);
      const { data } = await writeThrough(
        'job_note.create',
        { id, jobId: draft.jobId, techId, kind: draft.kind, body: draft.body, occurredAt: draft.occurredAt },
        draft.occurredAt,
        optimistic,
      );
      return data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * TechJobRepository
 * ------------------------------------------------------------------ */

export function createTechJobRepository(): TechJobRepository {
  return {
    async listAssignedToTech(techId: string) {
      const jobs = await readCached('ft.jobs.listAssignedToTech', { techId }, async () => {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, customers(name, phone), job_assignments!inner(tech_id)')
          .eq('job_assignments.tech_id', techId);
        if (error) {
          throw new Error(`listAssignedToTech failed: ${error.message}`);
        }
        return (data ?? []).map((row) => toJob(row as never));
      });
      for (const job of jobs) knownJobs.set(job.id, job);
      return jobs;
    },

    async getById(jobId: string, techId: string) {
      const job = await readCached('ft.jobs.getById', { jobId, techId }, async () => {
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
      });
      if (job) knownJobs.set(job.id, job);
      return job;
    },

    async updateStatusAsTech(jobId: string, techId: string, status) {
      const occurredAt = new Date().toISOString();
      const known = knownJobs.get(jobId);
      const optimistic = known
        ? { ...known, status }
        : toJob({
            id: jobId,
            organization_id: requireModuleSession().organizationId,
            status,
            assigned_tech_id: techId,
            created_at: occurredAt,
          } as never);
      const { data } = await writeThrough('job.updateStatusAsTech', { jobId, status }, occurredAt, optimistic);
      knownJobs.set(jobId, data);
      return data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * CalendarEventRepository
 * ------------------------------------------------------------------ */

export function createCalendarEventRepository(): CalendarEventRepository {
  return {
    async create(organizationId: string, draft: CalendarEventDraft): Promise<void> {
      // org + created_by come from the replay ctx (module session user), not auth.getUser().
      void organizationId;
      void requireModuleSession().userId;
      await writeThrough(
        'calendar_event.create',
        {
          id: newClientId(),
          jobId: draft.jobId,
          kind: draft.kind,
          title: draft.title ?? null,
          description: draft.description ?? null,
          eventTime: draft.eventTime,
        },
        draft.eventTime,
        undefined,
      );
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
    // Capture + copy into the local photo dir only. The upload runs inside the job_photo.create op handler.
    async capturePhoto(
      _kind: 'before' | 'after',
      target: { jobId: string; photoId: string },
    ): Promise<{ storagePath: string; localUri: string; ext: string } | null> {
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
      const { organizationId } = requireModuleSession();
      const ext = fileExt(asset.uri, 'jpg');
      const localUri = await copyToLocal(asset.uri, organizationId, target.jobId, target.photoId, ext);
      const storagePath = storagePathFor(organizationId, target.jobId, target.photoId, ext);
      return { storagePath, localUri, ext };
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
  materials_onsite?: boolean | null;
  tracking_number?: string | null;
  tracking_status?: string | null;
  tracking_checked_at?: string | null;
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
    materialsOnsite: row.materials_onsite === true,
    trackingNumber: row.tracking_number ?? null,
    trackingStatus: row.tracking_status ?? null,
    trackingCheckedAt: row.tracking_checked_at ?? null,
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
      return readCached('ft.estimates.getForJob', { jobId }, async () => {
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
      });
    },

    async upsertForJob(jobId: string, input: JobEstimateInput): Promise<JobEstimate> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();

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
      if (input.materialsOnsite !== undefined) {
        patch.materials_onsite = input.materialsOnsite;
      }
      if (input.trackingNumber !== undefined) {
        patch.tracking_number = input.trackingNumber;
      }
      if (input.trackingStatus !== undefined) {
        patch.tracking_status = input.trackingStatus;
      }
      if (input.trackingCheckedAt !== undefined) {
        patch.tracking_checked_at = input.trackingCheckedAt;
      }

      const optimistic = toJobEstimate({
        id: newClientId(),
        status: 'draft',
        materials_cost: 0,
        labor_cost: 0,
        other_cost: 0,
        total_cost: 0,
        deposit_amount: null,
        materials_onsite: false,
        tracking_number: null,
        tracking_status: null,
        tracking_checked_at: null,
        created_at: occurredAt,
        ...patch,
        updated_at: occurredAt,
      } as never);
      const { data } = await writeThrough('job_estimate.upsert', { jobId, input }, occurredAt, optimistic);
      return data;
    },

    async trackShipment(
      trackingNumber: string,
    ): Promise<{ ok: boolean; status: string | null; delivered: boolean; deliveredAt?: string | null; error?: string }> {
      const fail = (error: string) => ({ ok: false, status: null, delivered: false, error });
      try {
        const client: {
          functions: {
            invoke(fn: string, opts: { body: Record<string, unknown> }): Promise<{ data: unknown; error: { message: string } | null }>;
          };
        } = supabase;
        const result = await client.functions.invoke('ups-track', { body: { trackingNumber } });
        if (result.error) {
          return fail(result.error.message || 'ups-lookup-failed');
        }
        const d = result.data as Record<string, unknown> | null | undefined;
        if (!d || typeof d !== 'object') {
          return fail('ups-lookup-failed');
        }
        const ok = d.ok === true;
        const out: { ok: boolean; status: string | null; delivered: boolean; deliveredAt?: string | null; error?: string } = {
          ok,
          status: typeof d.status === 'string' ? d.status : null,
          delivered: d.delivered === true,
        };
        if (typeof d.deliveredAt === 'string') {
          out.deliveredAt = d.deliveredAt;
        }
        if (typeof d.error === 'string') {
          out.error = d.error;
        } else if (!ok) {
          out.error = 'ups-lookup-failed';
        }
        return out;
      } catch (e) {
        return fail(e instanceof Error && e.message ? e.message : 'ups-lookup-failed');
      }
    },

    async listLineItems(jobId: string): Promise<JobEstimateLineItem[]> {
      return readCached('ft.estimates.listLineItems', { jobId }, async () => {
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
      });
    },

    async addLineItem(jobId: string, draft: JobEstimateLineItemDraft): Promise<JobEstimateLineItem> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();

      const id = newClientId();
      const optimistic = toJobEstimateLineItem({
        id,
        job_id: jobId,
        organization_id: organizationId,
        kind: draft.kind,
        description: draft.description,
        quantity: draft.quantity,
        unit_cost: draft.unitCost,
        line_total: draft.lineTotal,
        created_by: userId,
        created_at: occurredAt,
      } as never);
      const { data } = await writeThrough('job_estimate_line_item.add', { id, jobId, draft }, occurredAt, optimistic);
      return data;
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
      requireOnline('share the estimate link');
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
  roomWork: Array<{ room: string; work: string }>;
  measurements: string | null;
  techInstructions: string | null;
  materialsArrived: boolean | null;
  redFlagMarginalEquipment: boolean;
  redFlagUndocumentedSystem: boolean;
  redFlagSubstandardStart: boolean;
  redFlagNotes: string | null;
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
  room_work: Array<{ room: string; work: string }> | null;
  measurements: string | null;
  tech_instructions: string | null;
  materials_arrived: boolean | null;
  red_flag_marginal_equipment?: boolean | null;
  red_flag_undocumented_system?: boolean | null;
  red_flag_substandard_start?: boolean | null;
  red_flag_notes?: string | null;
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
    roomWork: row.room_work ?? [],
    measurements: row.measurements,
    techInstructions: row.tech_instructions,
    materialsArrived: row.materials_arrived,
    redFlagMarginalEquipment: row.red_flag_marginal_equipment === true,
    redFlagUndocumentedSystem: row.red_flag_undocumented_system === true,
    redFlagSubstandardStart: row.red_flag_substandard_start === true,
    redFlagNotes: row.red_flag_notes ?? null,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getJobInvestigation(jobId: string): Promise<JobInvestigation | null> {
  return readCached('ft.investigation.getForJob', { jobId }, async () => {
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
  });
}

export function createJobPlanTaskRepository(): JobPlanTaskRepository {
  return {
    async listForJob(jobId: string): Promise<JobPlanTaskSummary[]> {
      return readCached('ft.planTasks.listForJob', { jobId }, async () => {
        const { organizationId } = requireModuleSession();
        const { data, error } = await supabase
          .from('job_plan_tasks')
          .select('id,title,kind,status,sort_order,unit,area,materials_note,content_updated_at')
          .eq('job_id', jobId)
          .eq('organization_id', organizationId)
          .order('sort_order', { ascending: true });
        if (error) throw new Error(`listJobPlanTasks failed: ${error.message}`);
        return (
          (data ?? []) as Array<{
            id: string;
            title: string;
            kind: string;
            status: string;
            unit?: string | null;
            area?: string | null;
            materials_note?: string | null;
            content_updated_at?: string | null;
          }>
        ).map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          status: r.status,
          unit: r.unit ?? null,
          area: r.area ?? null,
          materialsNote: r.materials_note ?? null,
          contentUpdatedAt: r.content_updated_at ?? new Date(0).toISOString(),
        }));
      });
    },
  };
}

export function createJobInvestigationRepository(): JobInvestigationRepository {
  return {
    async getForJob(jobId: string): Promise<JobInvestigation | null> {
      return getJobInvestigation(jobId);
    },

    async upsertForJob(jobId: string, patch: JobInvestigationInput): Promise<JobInvestigation> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();

      const optimistic = toJobInvestigation({
        id: newClientId(),
        job_id: jobId,
        organization_id: organizationId,
        tech_id: userId,
        ingress_notes: patch.ingressNotes ?? null,
        logistics_notes: patch.logisticsNotes ?? null,
        parking_notes: patch.parkingNotes ?? null,
        state_assessment: patch.stateAssessment ?? null,
        room_work: patch.roomWork ?? [],
        measurements: patch.measurements ?? null,
        tech_instructions: patch.techInstructions ?? null,
        materials_arrived: patch.materialsArrived ?? null,
        red_flag_marginal_equipment: patch.redFlagMarginalEquipment ?? false,
        red_flag_undocumented_system: patch.redFlagUndocumentedSystem ?? false,
        red_flag_substandard_start: patch.redFlagSubstandardStart ?? false,
        red_flag_notes: patch.redFlagNotes ?? null,
        submitted_at: patch.submittedAt ?? null,
        created_at: occurredAt,
        updated_at: occurredAt,
      } as never);
      const { data } = await writeThrough('job_investigation.upsert', { jobId, occurredAt, patch }, occurredAt, optimistic);
      return data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobPlanningPhotoRepo
 *
 * Prem-checklist planning photos. No image-manipulator dependency is
 * available, so size/quality are bounded via ImagePicker options.
 * ------------------------------------------------------------------ */

const PLANNING_PHOTO_SIGNED_URL_TTL_SECONDS = 3600;

function createJobPlanningPhotoRepository(): JobPlanningPhotoRepo {
  type PhotoRow = {
    id: string;
    job_id: string;
    storage_path: string;
    caption: string | null;
    created_at: string;
    job_plan_task_id?: string | null;
  };

  async function toPhoto(row: PhotoRow): Promise<JobPlanningPhoto> {
    planningPathById.set(row.id, row.storage_path);
    // Local file first, signed URL online, null offline.
    const url = await resolvePhotoUri(row.storage_path, localPathForStorage);
    return {
      id: row.id,
      jobId: row.job_id,
      storagePath: row.storage_path,
      caption: row.caption,
      createdAt: row.created_at,
      url,
      jobPlanTaskId: row.job_plan_task_id ?? null,
    };
  }

  return {
    async list(jobId: string): Promise<JobPlanningPhoto[]> {
      const rows = await readCached('ft.planningPhotos.list', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_planning_photos')
          .select('id, job_id, storage_path, caption, created_at, job_plan_task_id')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true });
        if (error) {
          throw new Error(`planningPhotos.list failed: ${error.message}`);
        }
        return (data ?? []) as PhotoRow[];
      });
      return Promise.all(rows.map(toPhoto));
    },

    async add(jobId: string, opts?: { jobPlanTaskId?: string | null }): Promise<JobPlanningPhoto | null> {
      const jobPlanTaskId = opts?.jobPlanTaskId ?? null;
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        exif: false,
      });
      if (result.canceled) {
        return null;
      }
      const asset = result.assets[0];
      if (!asset) {
        return null;
      }

      const { organizationId } = requireModuleSession();
      const contentType = asset.mimeType || 'image/jpeg';
      const subtype = contentType.split('/')[1]?.toLowerCase() ?? '';
      const ext =
        subtype === 'jpeg' || subtype === 'jpg'
          ? 'jpg'
          : subtype === 'png' || subtype === 'webp' || subtype === 'heic' || subtype === 'gif'
            ? subtype
            : 'jpg';
      const id = newClientId();
      const occurredAt = new Date().toISOString();
      const localUri = await copyToLocal(asset.uri, organizationId, jobId, id, ext);
      const storagePath = planningStoragePathFor(organizationId, jobId, id, ext);
      planningPathById.set(id, storagePath);
      const optimistic: JobPlanningPhoto = {
        id,
        jobId,
        storagePath,
        caption: null,
        createdAt: occurredAt,
        url: localUri,
        jobPlanTaskId,
      };
      const { data } = await writeThrough(
        'job_planning_photo.add',
        { id, jobId, storagePath, localUri, ext, contentType, jobPlanTaskId },
        occurredAt,
        optimistic,
      );
      return data;
    },

    async remove(photoId: string): Promise<void> {
      const storagePath = planningPathById.get(photoId);
      await writeThrough('job_planning_photo.remove', { id: photoId, storagePath }, new Date().toISOString(), undefined);
      planningPathById.delete(photoId);
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
      const id = newClientId();
      const optimistic = toTimeEntry({
        id,
        organization_id: organizationId,
        job_id: jobId,
        tech_id: userId,
        clock_in_at: occurredAt,
        clock_out_at: null,
        created_at: occurredAt,
      } as never);
      const { data } = await writeThrough('job_time_entry.clock_in', { id, jobId, clockInAt: occurredAt }, occurredAt, optimistic);
      knownEntries.set(data.id, data);
      return data;
    },

    async clockOut(entryId: string): Promise<TimeEntry> {
      const occurredAt = new Date().toISOString();
      const known = knownEntries.get(entryId);
      const optimistic: TimeEntry = known
        ? { ...known, clockOutAt: occurredAt }
        : toTimeEntry({
            id: entryId,
            organization_id: requireModuleSession().organizationId,
            job_id: '',
            tech_id: requireModuleSession().userId,
            clock_in_at: occurredAt,
            clock_out_at: occurredAt,
            created_at: occurredAt,
          } as never);
      const { data } = await writeThrough('job_time_entry.clock_out', { id: entryId, clockOutAt: occurredAt }, occurredAt, optimistic);
      knownEntries.set(entryId, data);
      return data;
    },

    async listForJob(jobId: string): Promise<TimeEntry[]> {
      const { organizationId } = requireModuleSession();

      const entries = await readCached('ft.timeEntries.listForJob', { jobId }, async () => {
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
      });
      for (const entry of entries) knownEntries.set(entry.id, entry);
      return entries;
    },
  };
}

/* ------------------------------------------------------------------ *
 * PremQueueRepository
 * ------------------------------------------------------------------ */

export function createPremQueueRepository(): PremQueueRepository {
  return {
    async listOpen(techId: string): Promise<{ items: PremQueueItem[]; unavailable: boolean }> {
      return readCached('ft.premQueue.listOpen', { techId }, async () => {
        const { data: jobRows, error: jobsError } = await supabase
          .from('jobs')
          .select('*, customers(name, phone)')
          .not('needs_prem_at', 'is', null)
          .order('needs_prem_at', { ascending: true });
        if (jobsError) {
          if ((jobsError as { code?: string }).code === '42703') {
            return { items: [], unavailable: true };
          }
          throw asError(jobsError);
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
        if (assignmentsError) throw asError(assignmentsError);
        const claimedByJobId = new Map<string, string>();
        for (const row of assignmentRows ?? []) {
          claimedByJobId.set(row.job_id as string, row.tech_id as string);
        }

        const { data: investigationRows, error: investigationsError } = await supabase
          .from('job_investigations')
          .select('job_id, submitted_at')
          .eq('tech_id', techId)
          .in('job_id', jobIds);
        if (investigationsError) throw asError(investigationsError);
        const mySubmittedJobIds = new Set(
          (investigationRows ?? [])
            .filter((row) => row.submitted_at != null)
            .map((row) => row.job_id as string)
        );

        const { data: summaryRows } = await supabase
          .from('job_task_summary_v')
          .select('job_id, task_titles')
          .in('job_id', jobIds);
        const titlesByJobId = new Map<string, string[]>();
        for (const row of (summaryRows ?? []) as Array<{ job_id: string; task_titles: string[] | null }>) {
          titlesByJobId.set(row.job_id, row.task_titles ?? []);
        }

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
            taskTitles: titlesByJobId.get(job.id) ?? [],
          });
        }
        return { items, unavailable: false };
      });
    },

    async claim(organizationId: string, jobId: string, techId: string): Promise<void> {
      void organizationId; // org comes from the replay ctx
      await writeThrough('job_assignment.claim', { id: newClientId(), jobId, techId }, new Date().toISOString(), undefined);
    },
  };
}

/* ------------------------------------------------------------------ *
 * ModulePorts aggregator
 * ------------------------------------------------------------------ */

export function buildFieldTechPorts(session?: PayrollRepoSession): ModulePorts {
  // Online signing for planning/job photo URLs; local file wins, offline yields null.
  setSignedUrlResolver(async (storagePath: string) => {
    const { data } = await supabase.storage
      .from(JOB_PHOTOS_BUCKET)
      .createSignedUrl(storagePath, PLANNING_PHOTO_SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  });
  return {
    ...(session ? { payroll: createPayrollRepos(supabase, session) } : {}),
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
    planTasks: createJobPlanTaskRepository(),
    planningPhotos: createJobPlanningPhotoRepository(),
    timeEntries: createTimeEntryRepository(),
    premQueue: createPremQueueRepository(),
    localPrefs: { getBool: getBoolPref, setBool: setBoolPref },
    techs: {
      list: async (orgId: string) => {
        return readCached('ft.techs.list', { orgId }, async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('organization_id', orgId)
            .order('full_name');
          if (error) throw asError(error);
          return (data ?? []).map((r: { id: string; full_name: string }) => ({ id: r.id, fullName: r.full_name }));
        });
      },
    },
  };
}
