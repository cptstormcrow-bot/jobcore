/**
 * Supabase-backed repository implementations for the admin-finance module's
 * data ports (P3d.1).
 *
 * `modules/admin-finance/src/data/ports.ts` declares interfaces only — no
 * sqlite, no fetch, no Supabase. This file is the host-side (apps/mobile)
 * concrete implementation the host injects via
 * `modules/admin-finance/src/lib/module-ports.ts`'s `setModulePorts`. This
 * is not a general framework for other modules — admin-finance's ports
 * only. Mirrors `apps/mobile/src/lib/field-tech-repos.ts`'s structure.
 *
 * Uses the shared `supabase` client from `apps/mobile/src/lib/supabase.ts`
 * (chunked SecureStore-backed auth session), matching the client-access
 * pattern already established elsewhere in the app.
 */

import { supabase } from './supabase';
import { enqueue } from './offline-db';
import { logSyncFailure } from './log';
import { makeIdempotencyKey } from '@jobcore/core';
import type { NewQueuedMutation, Job, JobStatus } from '@jobcore/core';
import type {
  JobRepository,
  JobRow,
  JobSchedulingPatch,
  PriceSheetRepository,
  PayPeriodRepository,
  LeadRepository,
  Tech,
  TechRepository,
  JobAssignmentDraft,
  JobAssignmentRepository,
  CommissionRepository,
  AuditLogRow,
  AuditLogEntry,
  AuditLogFilter,
  AuditLogRepository,
} from '../../../../modules/admin-finance/src/data/ports';
import { toJob, toAuditLogEntry } from '../../../../modules/admin-finance/src/data/ports';
import type { ModulePorts } from '../../../../modules/admin-finance/src/lib/module-ports';
import type { PriceSheet } from '../../../../modules/admin-finance/src/money/types';
import type { PayPeriod } from '../../../../modules/admin-finance/src/money/rollup';
import type { Lead } from '../../../../modules/admin-finance/src/domain/lead';
import type { JobDraft } from '../../../../modules/admin-finance/src/domain/qualify';
import type { NewLeadDraft } from '../../../../modules/admin-finance/src/domain/intake-normalize';
import type { CommissionLine } from '../../../../modules/admin-finance/src/money/types';

/**
 * Builds a nonce for `makeIdempotencyKey` without depending on a uuid
 * library. Mirrors `field-tech-repos.ts`'s identical helper for consistency
 * across the offline-queue call sites.
 */
function makeNonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Durably captures a mutation to the local offline queue (`./offline-db`)
 * BEFORE the corresponding direct Supabase write is attempted — mirrors
 * `field-tech-repos.ts`'s `enqueueMutation` (enqueue first, then perform the
 * direct write). Exactly-once replay is guaranteed by `id`'s idempotency
 * key (see `packages/core/src/offline/replay.ts` lines 93-97), not by
 * anything here. This does not replace the direct write below: repository
 * return types carry server-assigned fields (id/organization_id/created_at)
 * that only the network round trip can produce, so the enqueue only
 * guarantees the mutation is never lost when that round trip fails offline.
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
 * by this module's write path (reads go through `createAuditLogRepository`
 * below).
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
    logSyncFailure('admin-finance-repos.writeAudit', error.message, { draft });
    throw new Error(`writeAudit failed: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * JobRepository
 * ------------------------------------------------------------------ */

export function createJobRepository(): JobRepository {
  return {
    async listForOrganization(organizationId: string): Promise<Job[]> {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as JobRow[]).map(toJob);
    },

    async getById(jobId: string): Promise<Job | null> {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (error) {
        throw new Error(`getById failed: ${error.message}`);
      }
      return data ? toJob(data as JobRow) : null;
    },

    async patchScheduling(jobId: string, patch: JobSchedulingPatch): Promise<Job> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job.patch_scheduling', occurredAt, { jobId, patch });

      const { data, error } = await supabase
        .from('jobs')
        .update({
          assigned_tech_id: patch.assignedTechId,
          scheduled_start: patch.scheduledStart,
          scheduled_end: patch.scheduledEnd,
          requested_window: patch.requestedWindow,
        })
        .eq('id', jobId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.patchScheduling', error.message, { jobId, patch });
        throw new Error(`patchScheduling failed: ${error.message}`);
      }
      return toJob(data as JobRow);
    },

    async create(draft: JobDraft): Promise<Job> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job.create', occurredAt, draft);

      const { serviceAreaId, ...rest } = draft as JobDraft & { serviceAreaId?: string };
      const { data, error } = await supabase
        .from('jobs')
        .insert({
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
          assigned_tech_id: rest.assignedTechId,
          service_area_id: serviceAreaId,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.createJob', error.message, { draft });
        throw new Error(`create job failed: ${error.message}`);
      }
      return toJob(data as JobRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * PriceSheetRepository
 * ------------------------------------------------------------------ */

export function createPriceSheetRepository(): PriceSheetRepository {
  return {
    async listForOrganization(organizationId: string): Promise<PriceSheet[]> {
      const { data, error } = await supabase
        .from('price_sheets')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return (data ?? []) as PriceSheet[];
    },

    async getActive(organizationId: string): Promise<PriceSheet | null> {
      const { data, error } = await supabase
        .from('price_sheets')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'published')
        .maybeSingle();
      if (error) {
        throw new Error(`getActive failed: ${error.message}`);
      }
      return (data as PriceSheet | null) ?? null;
    },
  };
}

/* ------------------------------------------------------------------ *
 * PayPeriodRepository
 * ------------------------------------------------------------------ */

export function createPayPeriodRepository(): PayPeriodRepository {
  return {
    async listForOrganization(organizationId: string): Promise<PayPeriod[]> {
      const { data, error } = await supabase
        .from('pay_periods')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return (data ?? []) as PayPeriod[];
    },

    async getById(payPeriodId: string): Promise<PayPeriod | null> {
      const { data, error } = await supabase
        .from('pay_periods')
        .select('*')
        .eq('id', payPeriodId)
        .maybeSingle();
      if (error) {
        throw new Error(`getById failed: ${error.message}`);
      }
      return (data as PayPeriod | null) ?? null;
    },
  };
}

/* ------------------------------------------------------------------ *
 * LeadRepository
 * ------------------------------------------------------------------ */

export function createLeadRepository(): LeadRepository {
  return {
    async listForOrganization(organizationId: string): Promise<Lead[]> {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return (data ?? []) as Lead[];
    },

    async markQualified(leadId: string, jobId: string, qualifiedAt: string): Promise<Lead> {
      await enqueueMutation('lead.mark_qualified', qualifiedAt, { leadId, jobId, qualifiedAt });

      const { data, error } = await supabase
        .from('leads')
        .update({ qualified_at: qualifiedAt, converted_job_id: jobId })
        .eq('id', leadId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.markQualified', error.message, { leadId, jobId });
        throw new Error(`markQualified failed: ${error.message}`);
      }
      return data as Lead;
    },

    async create(draft: NewLeadDraft): Promise<Lead> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('lead.create', occurredAt, draft);

      const { data, error } = await supabase.from('leads').insert(draft).select('*').single();
      if (error) {
        logSyncFailure('admin-finance-repos.createLead', error.message, { draft });
        throw new Error(`create lead failed: ${error.message}`);
      }
      return data as Lead;
    },
  };
}

/* ------------------------------------------------------------------ *
 * TechRepository
 * ------------------------------------------------------------------ */

export function createTechRepository(): TechRepository {
  return {
    async listActiveTechs(organizationId: string): Promise<Tech[]> {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('organization_id', organizationId)
        .eq('role', 'tech')
        .eq('active', true);
      if (error) {
        throw new Error(`listActiveTechs failed: ${error.message}`);
      }
      return ((data ?? []) as Array<{ id: string; full_name: string }>).map((row) => ({
        id: row.id,
        fullName: row.full_name,
      }));
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobAssignmentRepository
 * ------------------------------------------------------------------ */

export function createJobAssignmentRepository(): JobAssignmentRepository {
  return {
    async create(organizationId: string, draft: JobAssignmentDraft): Promise<void> {
      await enqueueMutation('job_assignment.create', draft.assignedAt, { organizationId, ...draft });

      const { error } = await supabase.from('job_assignments').insert({
        organization_id: organizationId,
        job_id: draft.jobId,
        tech_id: draft.techId,
        assigned_at: draft.assignedAt,
      });
      if (error) {
        logSyncFailure('admin-finance-repos.createJobAssignment', error.message, { organizationId, draft });
        throw new Error(`create job assignment failed: ${error.message}`);
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * CommissionRepository
 * ------------------------------------------------------------------ */

export function createCommissionRepository(): CommissionRepository {
  return {
    async create(organizationId: string, line: CommissionLine, closedByUserId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('commission.create', occurredAt, { organizationId, line, closedByUserId });

      const { error } = await supabase.from('commissions').insert({
        organization_id: organizationId,
        user_id: closedByUserId,
        ...line,
      });
      if (error) {
        logSyncFailure('admin-finance-repos.createCommission', error.message, { organizationId, line });
        throw new Error(`create commission failed: ${error.message}`);
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * AuditLogRepository
 * ------------------------------------------------------------------ */

export function createAuditLogRepository(): AuditLogRepository {
  return {
    async listForOrganization(organizationId: string, filter?: AuditLogFilter): Promise<AuditLogEntry[]> {
      let query = supabase.from('audit_log').select('*').eq('organization_id', organizationId);
      if (filter?.entity) {
        query = query.eq('entity', filter.entity);
      }
      if (filter?.entityId) {
        query = query.eq('entity_id', filter.entityId);
      }
      if (filter?.action) {
        query = query.eq('action', filter.action);
      }
      if (filter?.fromDate) {
        query = query.gte('created_at', filter.fromDate);
      }
      if (filter?.toDate) {
        query = query.lte('created_at', filter.toDate);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as AuditLogRow[]).map(toAuditLogEntry);
    },
  };
}

/* ------------------------------------------------------------------ *
 * ModulePorts aggregator
 * ------------------------------------------------------------------ */

export function buildAdminFinancePorts(): ModulePorts {
  return {
    jobs: createJobRepository(),
    priceSheets: createPriceSheetRepository(),
    payPeriods: createPayPeriodRepository(),
    leads: createLeadRepository(),
    techs: createTechRepository(),
    jobAssignments: createJobAssignmentRepository(),
    commissions: createCommissionRepository(),
    auditLog: createAuditLogRepository(),
  };
}
