/**
 * Supabase-backed repository implementations for the admin-finance module's
 * data ports.
 *
 * `modules/admin-finance/src/data/ports.ts` declares interfaces only — no
 * sqlite, no fetch, no Supabase. This file is the host-side (apps/mobile)
 * concrete implementation the host injects via
 * `modules/admin-finance/src/lib/module-ports.ts`'s `setModulePorts`.
 *
 * Admin-finance is desk/office software, not field-tech's offline-first
 * mobile use case — these repositories call Supabase directly with no
 * offline queue (no `enqueueMutation`, no `./offline-db`, no `makeNonce`),
 * mirroring `field-tech-repos.ts`'s STYLE only (imports, error handling,
 * mapper usage), not its offline-queue machinery.
 *
 * Uses the shared `supabase` client from `apps/mobile/src/lib/supabase.ts`,
 * matching the client-access pattern already established elsewhere in the
 * app.
 */

import { supabase } from './supabase';
import { logSyncFailure } from './log';
import type {
  JobRepository,
  JobRow,
  JobSchedulingPatch,
  PriceSheetRepository,
  PriceSheetDraft,
  PayPeriodRepository,
  LeadRepository,
  LeadRow,
  TechRepository,
  Tech,
  JobAssignmentRepository,
  JobAssignmentDraft,
  CommissionRepository,
  AuditLogRepository,
  AuditLogRow,
  AuditLogFilter,
} from '../../../../modules/admin-finance/src/data/ports';
import { toJob, toLead, toAuditLogEntry } from '../../../../modules/admin-finance/src/data/ports';
import type { PriceSheet, PriceSheetStatus } from '../../../../modules/admin-finance/src/money/types';
import type { PayPeriod } from '../../../../modules/admin-finance/src/money/rollup';
import type { ModulePorts } from '../../../../modules/admin-finance/src/lib/module-ports';

/* ------------------------------------------------------------------ *
 * PriceSheet row <-> domain mapping
 *
 * `ports.ts` does not define a `PriceSheetRow`/`toPriceSheet` pair (the
 * PriceSheet port only declares `PriceSheetDraft` as an insertable shape),
 * so this file adds them here, modeled on `toJob`/`toLead`'s fail-closed
 * convention for the one enum field (`status`).
 * ------------------------------------------------------------------ */

/** Mirrors the Supabase `price_sheets` table (`app/supabase/0005_money.sql`). */
export interface PriceSheetRow {
  id: string;
  organization_id: string;
  version: number;
  status: string;
  published_at: string | null;
}

const PRICE_SHEET_STATUSES: readonly PriceSheetStatus[] = ['draft', 'published', 'archived'];

function isPriceSheetStatus(value: string): value is PriceSheetStatus {
  return (PRICE_SHEET_STATUSES as readonly string[]).includes(value);
}

/**
 * Map a `price_sheets` row to the domain `PriceSheet`. Throws on an
 * unrecognized status rather than widening the union — fail-closed, same
 * discipline as `ports.ts`'s `toJob`.
 */
export function toPriceSheet(row: PriceSheetRow): PriceSheet {
  if (!isPriceSheetStatus(row.status)) {
    throw new Error(`Unknown status "${row.status}" on price sheet ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    version: row.version,
    status: row.status,
    publishedAt: row.published_at,
  };
}

/* ------------------------------------------------------------------ *
 * PayPeriod row <-> domain mapping
 *
 * NOTE: no `pay_periods` table was found in `app/supabase/migrations`
 * (0001-0013) — this repository targets a `pay_periods` table name by
 * convention with the domain `PayPeriod` type (`start`/`end` columns), but
 * that table name is UNCONFIRMED against the shipped schema and should be
 * flagged.
 * ------------------------------------------------------------------ */

/** Assumed shape of a `pay_periods` row — table not found in migrations. */
export interface PayPeriodRow {
  id: string;
  organization_id: string;
  start: string;
  end: string;
}

function toPayPeriod(row: PayPeriodRow): PayPeriod {
  return {
    start: row.start,
    end: row.end,
  };
}

/* ------------------------------------------------------------------ *
 * JobRepository
 * ------------------------------------------------------------------ */

export function createJobRepository(): JobRepository {
  return {
    async listForOrganization(organizationId: string) {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as JobRow[]).map(toJob);
    },

    async getById(jobId: string) {
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

    async patchScheduling(jobId: string, patch: JobSchedulingPatch) {
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

    async create(draft) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          organization_id: draft.organizationId,
          status: draft.status,
          customer_id: draft.customerId,
          service_id: draft.serviceId,
          source: draft.source,
          payer: draft.payer,
          attach_timing: draft.attachTiming,
          requested_window: draft.requestedWindow,
          scheduled_start: draft.scheduledStart,
          scheduled_end: draft.scheduledEnd,
          address: draft.address,
          description: draft.description,
          assigned_tech_id: draft.assignedTechId,
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
    async listForOrganization(organizationId: string) {
      const { data, error } = await supabase
        .from('price_sheets')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as PriceSheetRow[]).map(toPriceSheet);
    },

    async getActive(organizationId: string) {
      const { data, error } = await supabase
        .from('price_sheets')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'published')
        .maybeSingle();
      if (error) {
        throw new Error(`getActive failed: ${error.message}`);
      }
      return data ? toPriceSheet(data as PriceSheetRow) : null;
    },

    async create(draft: PriceSheetDraft) {
      const { data, error } = await supabase
        .from('price_sheets')
        .insert({
          organization_id: draft.organizationId,
          version: draft.version,
          status: 'draft',
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.createPriceSheet', error.message, { draft });
        throw new Error(`create price sheet failed: ${error.message}`);
      }
      return toPriceSheet(data as PriceSheetRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * PayPeriodRepository
 * ------------------------------------------------------------------ */

export function createPayPeriodRepository(): PayPeriodRepository {
  return {
    async listForOrganization(organizationId: string) {
      const { data, error } = await supabase
        .from('pay_periods')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as PayPeriodRow[]).map(toPayPeriod);
    },

    async getById(payPeriodId: string) {
      const { data, error } = await supabase
        .from('pay_periods')
        .select('*')
        .eq('id', payPeriodId)
        .maybeSingle();
      if (error) {
        throw new Error(`getById failed: ${error.message}`);
      }
      return data ? toPayPeriod(data as PayPeriodRow) : null;
    },
  };
}

/* ------------------------------------------------------------------ *
 * LeadRepository
 * ------------------------------------------------------------------ */

export function createLeadRepository(): LeadRepository {
  return {
    async listForOrganization(organizationId: string) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as LeadRow[]).map(toLead);
    },

    async markQualified(leadId: string, jobId: string, qualifiedAt: string) {
      const { data, error } = await supabase
        .from('leads')
        .update({ qualified_at: qualifiedAt, converted_job_id: jobId })
        .eq('id', leadId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.markQualified', error.message, { leadId, jobId, qualifiedAt });
        throw new Error(`markQualified failed: ${error.message}`);
      }
      return toLead(data as LeadRow);
    },

    async create(draft) {
      const { data, error } = await supabase
        .from('leads')
        .insert({
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
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.createLead', error.message, { draft });
        throw new Error(`create lead failed: ${error.message}`);
      }
      return toLead(data as LeadRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * TechRepository
 *
 * There is no dedicated `techs` table — a tech is a `profiles` row with
 * `role = 'tech'` (`app/supabase/0001_foundation.sql`), matching the
 * `Tech` port's own doc comment in `ports.ts`.
 * ------------------------------------------------------------------ */

interface ProfileRow {
  id: string;
  full_name: string;
}

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
      return ((data ?? []) as ProfileRow[]).map((row) => ({ id: row.id, fullName: row.full_name }));
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobAssignmentRepository
 * ------------------------------------------------------------------ */

export function createJobAssignmentRepository(): JobAssignmentRepository {
  return {
    async create(organizationId: string, draft: JobAssignmentDraft): Promise<void> {
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
    async create(organizationId, line, closedByUserId) {
      const { error } = await supabase.from('commissions').insert({
        organization_id: organizationId,
        job_id: line.jobId,
        user_id: closedByUserId,
        price_sheet_id: line.priceSheetId,
        compensation_policy_id: line.compensationPolicyId,
        amount_cents: line.amount,
      });
      if (error) {
        logSyncFailure('admin-finance-repos.createCommission', error.message, {
          organizationId,
          line,
          closedByUserId,
        });
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
    async listForOrganization(organizationId: string, filter?: AuditLogFilter) {
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
