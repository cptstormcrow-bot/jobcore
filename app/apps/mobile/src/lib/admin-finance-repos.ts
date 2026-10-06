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

import { supabase, supabaseUrl } from './supabase';
import { ReconciliationView } from '@jobcore/payment-review';
import type { SupabaseSelectClient as PaymentReviewClient } from '@jobcore/payment-review';
import type { CalculationResult } from '../../../../modules/admin-finance/src/money/types';
import type { PostgrestError } from '@supabase/supabase-js';
import { enqueue } from './offline-db';
import { logSyncFailure } from './log';
import { getBoolPref, setBoolPref } from './local-prefs';
import { makeIdempotencyKey } from '@jobcore/core';
import type { NewQueuedMutation, Job, Commission, JobStatus, Profile, Role, VehicleStatus, ToolStatus } from '@jobcore/core';
import type {
  JobRepository,
  JobRow,
  JobSchedulingPatch,
  JobDetailsPatch,
  JobLifecyclePatch,
  PriceSheetRepository,
  PayPeriodRepository,
  LeadRepository,
  JobAssignmentDraft,
  JobAssignmentRepository,
  CommissionRepository,
  AuditLogRow,
  AuditLogEntry,
  AuditLogFilter,
  AuditLogRepository,
  CloseOutPhoto,
  JobPhotoRepository,
  JobNoteRepository,
  JobContactLogRepository,
  JobContactLogEntry,
  PaymentRow,
  PaymentsRepository,
  Payment,
  CalendarEventRepository,
  CalendarEventDraft,
  TechServiceAreaRepository,
  ServiceAreaRepository,
  CustomerRow,
  Customer,
  CustomerRepository,
  CustomerCreateInput,
  CustomerPatch,
  EmployeeRepository,
  ProfilePrivate,
  InvitationRepository,
  Invitation,
  TechSkillRepository,
  PriceSheetDraft,
  JobPlanningRepository,
  JobPlanningPhotoRepository,
  JobPlanningDetails,
  JobPlanningDetailsInput,
  JobPlanningPhoto,
  JobPlanningPhotoInput,
  EstimateRepository,
  JobEstimate,
  JobEstimateLineItem,
  JobEstimateLineItemDraft,
  JobEstimateInput,
  JobPlanTasksRepository,
  JobPlanTaskRow,
  ServiceTaskCatalogEntry,
  TimeEntryRepository,
  TimeEntryRow,
  TimeEntry,
  CloseOutFailureRepository,
  CloseOutFailureStage,
  CloseOutFailureRow,
  CloseOutFailureRecord,
} from '../../../../modules/admin-finance/src/data/ports';
import { toJob, toAuditLogEntry, toPayment, toCustomer, isVehicleStatus, isToolStatus, DuplicateInvitationError, toLead, toLeadRowPatch, toCloseOutFailure } from '../../../../modules/admin-finance/src/data/ports';
import type { ModulePorts } from '../../../../modules/admin-finance/src/lib/module-ports';
import { getModuleSession } from '../../../../modules/admin-finance/src/lib/module-session';
import type { PriceSheet } from '../../../../modules/admin-finance/src/money/types';
import type { PayPeriod } from '../../../../modules/admin-finance/src/money/rollup';
import type { Lead, LeadRow } from '../../../../modules/admin-finance/src/domain/lead';
import type { LeadPatch } from '../../../../modules/admin-finance/src/data/ports';
import type { JobDraft } from '../../../../modules/admin-finance/src/domain/qualify';
import type { NewLeadDraft } from '../../../../modules/admin-finance/src/domain/intake-normalize';
import type { CommissionLine } from '../../../../modules/admin-finance/src/money/types';
import type {
  PriceSheetRepo,
  PriceSheetRow,
  PriceSheetRateRow,
} from '../../../../modules/admin-finance/src/data/price-sheet-repo';
import { toPriceSheet, toPriceSheetRate, toPriceSheetRateWithTask, applyPublishPlanViaRpc, listAreaAdjustments, saveAreaAdjustment, deleteAreaAdjustment as deleteAreaAdjustmentRepo, listServiceTasks as listServiceTasksRepo, saveServiceTask as saveServiceTaskRepo, updateServiceTask as updateServiceTaskRepo, deleteServiceTask as deleteServiceTaskRepo, saveRate as saveRateRepo, deleteRate as deleteRateRepo } from '../../../../modules/admin-finance/src/data/price-sheet-repo';
import type { PriceSheetRateWithTaskRow } from '../../../../modules/admin-finance/src/data/price-sheet-repo';
import { getStandardDuration, upsertStandardDuration } from '../../../../modules/admin-finance/src/data/price-sheet-standard-duration-repo';
import type {
  ReimbursementRepo,
  ReimbursementRow,
  ApproveReimbursementInput,
  RejectReimbursementInput,
} from '../../../../modules/admin-finance/src/data/reimbursement-repo';
import { toReimbursement, approveReimbursementViaRpc, rejectReimbursementViaRpc } from '../../../../modules/admin-finance/src/data/reimbursement-repo';
import type {
  PayoutBatchRepo,
  PayoutBatchRow,
  PayoutLineRow,
} from '../../../../modules/admin-finance/src/data/payout-batch-repo';
import type { PayoutBatch } from '../../../../modules/admin-finance/src/money/payout-batch';
import { toPayoutBatch, persistPayoutBatchViaRpc } from '../../../../modules/admin-finance/src/data/payout-batch-repo';
import type {
  TimeOffAdminRepo,
  TimeOffRequestAdminRow,
} from '../../../../modules/admin-finance/src/data/time-off-repo';
import { toTimeOffRequestAdmin } from '../../../../modules/admin-finance/src/data/time-off-repo';
import { toTimeEntry } from '../../../../modules/admin-finance/src/data/ports';
import { listTechServiceAreas } from '../../../../modules/admin-finance/src/data/tech-service-area-repo';
import { listTechSkills } from '../../../../modules/admin-finance/src/data/tech-skill-repo';
import { listServiceAreas } from '../../../../modules/admin-finance/src/data/service-area-repo';

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

/**
 * Closes out a job by invoking a `close_out_job_write` RPC. Mirrors
 * `price-sheet-repo.ts`'s `applyPublishPlanViaRpc` / `reimbursement-repo.ts`'s
 * `approveReimbursementViaRpc` shape: takes the Supabase RPC client as a
 * parameter, maps an `error` to `{ ok: false, reason }`, and maps the
 * returned row back to the domain type via `toJob`.
 */
export async function closeOutJobWriteViaRpc(
  client: Pick<typeof supabase, 'rpc'>,
  jobId: string,
  fromStatus: JobStatus,
  commission: CommissionLine,
  closedByUserId: string,
): Promise<{ ok: true; value: Job } | { ok: false; reason: string }> {
  const { data, error } = await client.rpc('close_out_job_write', {
    p_job_id: jobId,
    p_from_status: fromStatus,
    p_price_sheet_id: commission.priceSheetId,
    p_compensation_policy_id: commission.compensationPolicyId,
    p_commission_amount_cents: commission.amount,
    p_closed_by_user_id: closedByUserId,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toJob(data as JobRow) };
}

export function createJobRepository(): JobRepository {
  return {
    async listForOrganization(organizationId: string): Promise<Job[]> {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, customers(name)')
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

    async patchLifecycle(jobId: string, patch: JobLifecyclePatch): Promise<Job> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job.patch_lifecycle', occurredAt, { jobId, patch });

      const update: Record<string, string | null> = {};
      if (patch.enRouteAt !== undefined) update.en_route_at = patch.enRouteAt;
      if (patch.inProgressAt !== undefined) update.in_progress_at = patch.inProgressAt;
      if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;

      const { data, error } = await supabase
        .from('jobs')
        .update(update)
        .eq('id', jobId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.patchLifecycle', error.message, { jobId, patch });
        throw new Error(`patchLifecycle failed: ${error.message}`);
      }
      return toJob(data as JobRow);
    },

    async markBeta(jobId: string, isBeta: boolean): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job.markBeta', occurredAt, { jobId, isBeta });

      const { error } = await supabase.from('jobs').update({ is_beta: isBeta }).eq('id', jobId);
      if (error) {
        logSyncFailure('admin-finance-repos.markBeta', error.message, { jobId, isBeta });
        throw new Error(`markBeta failed: ${error.message}`);
      }
    },

    async setNeedsPrem(jobId: string, at: string | null): Promise<void> {
      const { error } = await supabase.from('jobs').update({ needs_prem_at: at }).eq('id', jobId);
      if (error) {
        logSyncFailure('admin-finance-repos.setNeedsPrem', error.message, { jobId, at });
        throw new Error(`setNeedsPrem failed: ${error.message}`);
      }
    },

    async clearInvestigator(jobId: string): Promise<void> {
      await supabase.from('job_assignments').delete().eq('job_id', jobId).eq('kind', 'investigator');
    },

    async resetTimeSegments(jobId: string): Promise<void> {
      const { error } = await supabase.rpc('reset_job_time_segments', { p_job_id: jobId });
      if (error) {
        throw new Error(`resetTimeSegments failed: ${error.message}`);
      }
    },

    async updateDetails(jobId: string, patch: JobDetailsPatch): Promise<Job> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job.update_details', occurredAt, { jobId, patch });

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

      const { data, error } = await supabase
        .from('jobs')
        .update(update)
        .eq('id', jobId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.updateDetails', error.message, { jobId, patch });
        throw new Error(`updateDetails failed: ${error.message}`);
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
          house_age_years: rest.houseAgeYears ?? null,
          ingress_instructions: rest.ingressInstructions ?? null,
          assigned_tech_id: rest.assignedTechId,
          service_area_id: serviceAreaId,
          permit_status: rest.permitStatus,
          parking_available: rest.parkingAvailable,
          rooms: rest.rooms,
          panel_info: rest.panelInfo,
          considerations: rest.considerations,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.createJob', error.message, { draft });
        throw new Error(`create job failed: ${error.message}`);
      }
      return toJob(data as JobRow);
    },

    async updateStatus(jobId: string, status: JobStatus): Promise<Job> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job.update_status', occurredAt, { jobId, status });

      const { data, error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', jobId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.updateStatus', error.message, { jobId, status });
        throw new Error(`updateStatus failed: ${error.message}`);
      }
      return toJob(data as JobRow);
    },

    async closeOutWrite(
      jobId: string,
      fromStatus: JobStatus,
      commission: CommissionLine,
      closedByUserId: string,
    ): Promise<Job> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('close_out_job_write', occurredAt, {
        jobId,
        fromStatus,
        commission,
        closedByUserId,
      });

      const result = await closeOutJobWriteViaRpc(supabase, jobId, fromStatus, commission, closedByUserId);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.closeOutWrite', result.reason, { jobId, fromStatus, commission, closedByUserId });
        throw new Error(`closeOutWrite failed: ${result.reason}`);
      }
      return result.value;
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
      return ((data ?? []) as PriceSheetRow[]).map(toPriceSheet);
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
      return data ? toPriceSheet(data as PriceSheetRow) : null;
    },

    async create(draft: PriceSheetDraft): Promise<PriceSheet> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('price_sheet.create', occurredAt, draft);

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
      return (data ?? []).map((row) => toLead(row as LeadRow));
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
      return toLead(data as LeadRow);
    },

    async create(draft: NewLeadDraft): Promise<Lead> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('lead.create', occurredAt, draft);

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

    async update(leadId: string, patch: LeadPatch): Promise<Lead> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('lead.update', occurredAt, { leadId, patch });

      const { data, error } = await supabase
        .from('leads')
        .update(toLeadRowPatch(patch))
        .eq('id', leadId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.updateLead', error.message, { leadId, patch });
        throw new Error(`update lead failed: ${error.message}`);
      }
      return toLead(data as LeadRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * EmployeeRepository
 * ------------------------------------------------------------------ */

function toProfile(row: {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string | null;
  email?: string | null;
  role: Role;
  active: boolean;
  is_test: boolean;
  created_at: string;
  address: string | null;
  drivers_license_number: string | null;
  vehicle_status: string | null;
  tool_status: string | null;
  paid_travel: boolean;
  paid_travel_policy_message: string | null;
  hourly_rate_cents: number | null;
  test_jobs_only: boolean;
}): Profile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email ?? null,
    role: row.role,
    active: row.active,
    isTest: row.is_test,
    createdAt: row.created_at,
    address: row.address,
    driversLicenseNumber: row.drivers_license_number,
    vehicleStatus: row.vehicle_status && isVehicleStatus(row.vehicle_status) ? row.vehicle_status : null,
    toolStatus: row.tool_status && isToolStatus(row.tool_status) ? row.tool_status : null,
    paidTravel: row.paid_travel,
    paidTravelPolicyMessage: row.paid_travel_policy_message,
    defaultHourlyRateCents: row.hourly_rate_cents ?? undefined,
    testJobsOnly: row.test_jobs_only === true,
  };
}

export function createEmployeeRepository(): EmployeeRepository {
  return {
    async listEmployees(organizationId: string): Promise<Profile[]> {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('full_name');
      if (error) {
        throw new Error(`listEmployees failed: ${error.message}`);
      }
      return ((data ?? []) as Array<Parameters<typeof toProfile>[0]>).map(toProfile);
    },

    async getEmployee(profileId: string): Promise<Profile | null> {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();
      if (error) {
        throw new Error(`getEmployee failed: ${error.message}`);
      }
      return data ? toProfile(data as Parameters<typeof toProfile>[0]) : null;
    },

    async changeEmployeeEmail(id: string, email: string): Promise<void> {
      // Minimal-client injection shape (see sales-marketing meta.ts).
      const client: {
        functions: {
          invoke(
            fn: string,
            opts: { body: Record<string, unknown> },
          ): Promise<{ data: unknown; error: { message: string; context?: { status?: number } } | null }>;
        };
      } = supabase;
      let result: Awaited<ReturnType<typeof client.functions.invoke>>;
      try {
        result = await client.functions.invoke('admin-update-email', { body: { userId: id, email } });
      } catch (e) {
        throw new Error(`Could not change email (are you offline?): ${e instanceof Error ? e.message : String(e)}`);
      }
      if (result.error) {
        if (result.error.context?.status === 409) {
          throw new Error('That email is already in use');
        }
        throw new Error(`Could not change email: ${result.error.message}`);
      }
    },

    async updateEmployee(
      profileId: string,
      updates: {
        fullName?: string;
        phone?: string | null;
        isTest?: boolean;
        address?: string | null;
        driversLicenseNumber?: string | null;
        vehicleStatus?: VehicleStatus | null;
        toolStatus?: ToolStatus | null;
        paidTravel?: boolean;
        paidTravelPolicyMessage?: string | null;
        defaultHourlyRateCents?: number;
        testJobsOnly?: boolean;
      },
    ): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('employee.update', occurredAt, { profileId, updates });

      const patch: Record<string, unknown> = {};
      if (updates.fullName !== undefined) {
        patch.full_name = updates.fullName;
      }
      if (updates.phone !== undefined) {
        patch.phone = updates.phone;
      }
      if (updates.isTest !== undefined) {
        patch.is_test = updates.isTest;
      }
      if (updates.address !== undefined) {
        patch.address = updates.address;
      }
      if (updates.driversLicenseNumber !== undefined) {
        patch.drivers_license_number = updates.driversLicenseNumber;
      }
      if (updates.vehicleStatus !== undefined) {
        patch.vehicle_status = updates.vehicleStatus;
      }
      if (updates.toolStatus !== undefined) {
        patch.tool_status = updates.toolStatus;
      }
      if (updates.paidTravel !== undefined) {
        patch.paid_travel = updates.paidTravel;
      }
      if (updates.paidTravelPolicyMessage !== undefined) {
        patch.paid_travel_policy_message = updates.paidTravelPolicyMessage;
      }
      if (updates.defaultHourlyRateCents !== undefined) {
        patch.hourly_rate_cents = updates.defaultHourlyRateCents;
      }
      if (updates.testJobsOnly !== undefined) {
        patch.test_jobs_only = updates.testJobsOnly;
      }

      const { data, error } = await supabase.from('profiles').update(patch).eq('id', profileId).select('id');
      if (error) {
        logSyncFailure('admin-finance-repos.updateEmployee', error.message, { profileId, updates });
        throw new Error(`updateEmployee failed: ${error.message}`);
      }
      if (!data || data.length === 0) {
        throw new Error('Save did not apply — you may not have permission');
      }
    },

    async deactivateEmployee(profileId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('employee.deactivate', occurredAt, { profileId });

      const { error } = await supabase.from('profiles').update({ active: false }).eq('id', profileId);
      if (error) {
        logSyncFailure('admin-finance-repos.deactivateEmployee', error.message, { profileId });
        throw new Error(`deactivateEmployee failed: ${error.message}`);
      }
    },

    async reactivateEmployee(profileId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('employee.reactivate', occurredAt, { profileId });

      const { error } = await supabase.from('profiles').update({ active: true }).eq('id', profileId);
      if (error) {
        logSyncFailure('admin-finance-repos.reactivateEmployee', error.message, { profileId });
        throw new Error(`reactivateEmployee failed: ${error.message}`);
      }
    },

    async setEmployeeRole(profileId: string, role: Role): Promise<void> {
      // Deliberately NOT routed through enqueueMutation/the offline queue —
      // this RPC needs the live authenticated admin session synchronously
      // for its own internal admin check and cannot be deferred/replayed.
      const { error } = await supabase.rpc('admin_set_employee_role', {
        p_profile_id: profileId,
        p_new_role: role,
      });
      if (error) {
        throw new Error(`setEmployeeRole failed: ${error.message}`);
      }
    },
    async getPrivate(profileId) {
      const { data, error } = await supabase.from('profile_private').select('ssn_last4, emergency_contact_name, emergency_contact_phone').eq('profile_id', profileId).maybeSingle();
      if (error) throw new Error(`getPrivate failed: ${error.message}`);
      if (!data) return null;
      return { ssnLast4: data.ssn_last4 ?? null, emergencyContactName: data.emergency_contact_name ?? null, emergencyContactPhone: data.emergency_contact_phone ?? null };
    },
    async upsertPrivate(profileId, organizationId, patch) {
      if (patch.ssnLast4 != null && !/^\d{4}$/.test(patch.ssnLast4)) throw new Error('upsertPrivate: ssnLast4 must be exactly 4 digits');
      const row: Record<string, unknown> = { profile_id: profileId, organization_id: organizationId, updated_at: new Date().toISOString() };
      if (patch.ssnLast4 !== undefined) row.ssn_last4 = patch.ssnLast4;
      if (patch.emergencyContactName !== undefined) row.emergency_contact_name = patch.emergencyContactName;
      if (patch.emergencyContactPhone !== undefined) row.emergency_contact_phone = patch.emergencyContactPhone;
      const { error } = await supabase.from('profile_private').upsert(row, { onConflict: 'profile_id' });
      if (error) throw new Error(`upsertPrivate failed: ${error.message}`);
    },
  };
}

/* ------------------------------------------------------------------ *
 * InvitationRepository
 * ------------------------------------------------------------------ */

function toInvitation(row: {
  id: string;
  organization_id: string;
  email: string;
  role: Role;
  created_at: string;
}): Invitation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

function isDuplicatePendingInvitation(error: PostgrestError): boolean {
  return error.code === '23505' && error.message.includes('invitations_pending_email_idx');
}

export function createInvitationRepository(): InvitationRepository {
  return {
    async createInvitation(organizationId: string, email: string, role: Role, fullName?: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('invitation.create', occurredAt, { organizationId, email, role });

      const { error } = await supabase.from('invitations').insert({
        organization_id: organizationId,
        email,
        role,
        full_name: fullName?.trim() || email,
      });
      if (error) {
        logSyncFailure('admin-finance-repos.createInvitation', error.message, { organizationId, email, role });
        if (isDuplicatePendingInvitation(error)) {
          throw new DuplicateInvitationError(email);
        }
        throw new Error(`createInvitation failed: ${error.message}`);
      }
    },

    async listPendingInvitations(organizationId: string): Promise<Invitation[]> {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .is('consumed_at', null);
      if (error) {
        throw new Error(`listPendingInvitations failed: ${error.message}`);
      }
      return ((data ?? []) as Array<Parameters<typeof toInvitation>[0]>).map(toInvitation);
    },

    async findPendingInvitation(organizationId: string, email: string): Promise<Invitation | null> {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .ilike('email', email)
        .is('consumed_at', null)
        .maybeSingle();
      if (error) {
        throw new Error(`findPendingInvitation failed: ${error.message}`);
      }
      return data ? toInvitation(data as Parameters<typeof toInvitation>[0]) : null;
    },

    async revokeInvitation(invitationId: string): Promise<void> {
      const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
      if (error) {
        logSyncFailure('admin-finance-repos.revokeInvitation', error.message, { invitationId });
        throw new Error(`revokeInvitation failed: ${error.message}`);
      }
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

      // Investigator re-assignment: the partial unique index (0065) allows one investigator row
      // per job and supabase-js upsert cannot target a partial index, so delete the old row then
      // insert. Delete-then-insert (not update) keeps the BEFORE INSERT time-off blackout trigger
      // (0035, deny_job_assignment_on_time_off) firing for the new assignee.
      const isInvestigator = draft.kind === 'investigator';
      let priorTechId: string | null = null;
      if (isInvestigator) {
        priorTechId = await this.getInvestigatorTechId(draft.jobId);
        const { error: delError } = await supabase
          .from('job_assignments')
          .delete()
          .eq('job_id', draft.jobId)
          .eq('kind', 'investigator');
        if (delError) {
          logSyncFailure('admin-finance-repos.createJobAssignment', delError.message, { organizationId, draft });
          throw new Error(`create job assignment failed: ${delError.message}`);
        }
      }

      const { error } = await supabase.from('job_assignments').insert({
        organization_id: organizationId,
        job_id: draft.jobId,
        tech_id: draft.techId,
        assigned_at: draft.assignedAt,
        kind: draft.kind ?? 'installer',
      });
      if (error && isInvestigator && priorTechId && priorTechId !== draft.techId) {
        try {
          await supabase.from('job_assignments').insert({
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
      if (error) {
        logSyncFailure('admin-finance-repos.createJobAssignment', error.message, { organizationId, draft });
        throw new Error(`create job assignment failed: ${error.message}`);
      }
    },

    async getInvestigatorTechId(jobId: string): Promise<string | null> {
      const { data, error } = await supabase
        .from('job_assignments')
        .select('tech_id, assigned_at')
        .eq('job_id', jobId)
        .eq('kind', 'investigator')
        .order('assigned_at', { ascending: false })
        .limit(1);
      if (error) throw new Error(`get investigator tech failed: ${error.message}`);
      return (data?.[0]?.tech_id as string | undefined) ?? null;
    },

    async removeInvestigator(jobId: string): Promise<void> {
      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('job_id', jobId)
        .eq('kind', 'investigator');
      if (error) {
        logSyncFailure('admin-finance-repos.removeInvestigator', error.message, { jobId });
        throw new Error(`remove investigator failed: ${error.message}`);
      }
    },

    async listInvestigatorTechIds(jobIds: string[]): Promise<Record<string, string>> {
      if (jobIds.length === 0) {
        return {};
      }
      const { data, error } = await supabase
        .from('job_assignments')
        .select('job_id, tech_id, assigned_at')
        .in('job_id', jobIds)
        .eq('kind', 'investigator')
        .order('assigned_at', { ascending: false });
      if (error) throw new Error(`list investigator techs failed: ${error.message}`);
      const result: Record<string, string> = {};
      for (const row of data ?? []) {
        if (!(row.job_id in result)) {
          result[row.job_id] = row.tech_id as string;
        }
      }
      return result;
    },

    async removeForJob(jobId: string): Promise<void> {
      const { error } = await supabase.from('job_assignments').delete().eq('job_id', jobId);
      if (error) {
        logSyncFailure('admin-finance-repos.removeJobAssignments', error.message, { jobId });
        throw new Error(`remove job assignments failed: ${error.message}`);
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

    async listForOrganization(organizationId: string): Promise<Commission[]> {
      const { data, error } = await supabase
        .from('commissions')
        .select('job_id, amount_cents')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as Array<{ job_id: string; amount_cents: number }>).map((row) => ({
        jobId: row.job_id,
        amount: row.amount_cents,
      }));
    },
  };
}

/* ------------------------------------------------------------------ *
 * PriceSheetRepo (publish flow)
 * ------------------------------------------------------------------ */

export function createPriceSheetPublishRepository(): PriceSheetRepo {
  return {
    async listForOrganization(organizationId: string): Promise<PriceSheet[]> {
      const { data, error } = await supabase
        .from('price_sheets')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as PriceSheetRow[]).map(toPriceSheet);
    },

    async listRates(priceSheetId: string): Promise<import('../../../../modules/admin-finance/src/money/types').PriceSheetRate[]> {
      const { data, error } = await supabase
        .from('price_sheet_rates')
        .select('*')
        .eq('price_sheet_id', priceSheetId);
      if (error) {
        throw new Error(`listRates failed: ${error.message}`);
      }
      return ((data ?? []) as PriceSheetRateRow[]).map(toPriceSheetRate);
    },

    async getPublished(organizationId: string): Promise<PriceSheet | null> {
      const { data, error } = await supabase
        .from('price_sheets')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'published')
        .maybeSingle();
      if (error) {
        throw new Error(`getPublished failed: ${error.message}`);
      }
      return data ? toPriceSheet(data as PriceSheetRow) : null;
    },

    async applyPublishPlan(
      organizationId: string,
      plan: import('../../../../modules/admin-finance/src/money/publish-plan').PublishPlan,
    ): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('price_sheet.apply_publish_plan', occurredAt, { organizationId, plan });

      const result = await applyPublishPlanViaRpc(supabase as unknown as Parameters<typeof applyPublishPlanViaRpc>[0], plan);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.applyPublishPlan', result.reason, { organizationId, plan });
        throw new Error(`applyPublishPlan failed: ${result.reason}`);
      }
    },
  };
}

export function createPriceSheetAreaAdjustmentsRepository() {
  return {
    async list(priceSheetId: string) {
      return listAreaAdjustments(supabase as unknown as Parameters<typeof listAreaAdjustments>[0], priceSheetId);
    },
    async save(
      priceSheetId: string,
      serviceAreaId: string,
      adjustmentType: 'percent' | 'flat',
      adjustmentValue: number
    ) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('price_sheet_area_adjustment.save', occurredAt, {
        priceSheetId,
        serviceAreaId,
        adjustmentType,
        adjustmentValue,
      });
      const result = await saveAreaAdjustment(
        supabase as unknown as Parameters<typeof saveAreaAdjustment>[0],
        priceSheetId,
        serviceAreaId,
        adjustmentType,
        adjustmentValue
      );
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.saveAreaAdjustment', result.reason, {
          priceSheetId,
          serviceAreaId,
          adjustmentType,
          adjustmentValue,
        });
      }
      return result;
    },
    async remove(id: string): Promise<CalculationResult<void>> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('price_sheet_area_adjustment.remove', occurredAt, { id });
      const result = await deleteAreaAdjustmentRepo(
        supabase as unknown as Parameters<typeof deleteAreaAdjustmentRepo>[0],
        id
      );
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.deleteAreaAdjustment', result.reason, { id });
      }
      return result;
    },
  };
}

export function createPriceSheetRatesRepository() {
  return {
    async list(priceSheetId: string) {
      const { data, error } = await supabase
        .from('price_sheet_rates')
        .select('*, service_tasks(name)')
        .eq('price_sheet_id', priceSheetId);
      if (error) {
        throw new Error(`listRates failed: ${error.message}`);
      }
      return ((data ?? []) as PriceSheetRateWithTaskRow[]).map(toPriceSheetRateWithTask);
    },
    async save(
      priceSheetId: string,
      serviceId: string,
      taskId: string | null,
      attachTiming: string,
      amount: number,
      timeEstimateMinutes: number | null,
      id?: string
    ) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('price_sheet_rate.save', occurredAt, {
        priceSheetId,
        serviceId,
        taskId,
        attachTiming,
        amount,
        timeEstimateMinutes,
        id,
      });
      const result = await saveRateRepo(
        supabase as unknown as Parameters<typeof saveRateRepo>[0],
        priceSheetId,
        serviceId,
        taskId,
        attachTiming,
        amount,
        timeEstimateMinutes,
        id
      );
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.saveRate', result.reason, {
          priceSheetId,
          serviceId,
          taskId,
          attachTiming,
          amount,
          timeEstimateMinutes,
        });
      }
      return result;
    },
    async remove(rateId: string) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('price_sheet_rate.remove', occurredAt, { rateId });
      const result = await deleteRateRepo(
        supabase as unknown as Parameters<typeof deleteRateRepo>[0],
        rateId
      );
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.deleteRate', result.reason, { rateId });
      }
      return result;
    },
  };
}

export function createServiceTasksRepository() {
  return {
    async list(organizationId: string, serviceId?: string) {
      const result = await listServiceTasksRepo(
        supabase as unknown as Parameters<typeof listServiceTasksRepo>[0],
        organizationId,
        serviceId
      );
      return result;
    },
    async save(
      organizationId: string,
      serviceId: string,
      name: string,
      extra?: {
        estimatedMinutes?: number | null;
        rate?: number | null;
        category?: string | null;
        active?: boolean;
        priceCents?: number | null;
        details?: string | null;
        materials?: string | null;
      }
    ) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('service_task.save', occurredAt, { organizationId, serviceId, name, extra });
      const result = await saveServiceTaskRepo(
        supabase as unknown as Parameters<typeof saveServiceTaskRepo>[0],
        organizationId,
        serviceId,
        name,
        extra
      );
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.saveServiceTask', result.reason, { organizationId, serviceId, name, extra });
      }
      return result;
    },
    async remove(taskId: string): Promise<CalculationResult<void>> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('service_task.remove', occurredAt, { taskId });
      const result = await deleteServiceTaskRepo(
        supabase as unknown as Parameters<typeof deleteServiceTaskRepo>[0],
        taskId
      );
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.deleteServiceTask', result.reason, { taskId });
      }
      return result;
    },
    async updateServiceTask(
      taskId: string,
      patch: {
        name?: string;
        estimatedMinutes?: number | null;
        rate?: number | null;
        category?: string | null;
        active?: boolean;
        priceCents?: number | null;
        details?: string | null;
        materials?: string | null;
      }
    ) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('service_task.update', occurredAt, { taskId, patch });
      const result = await updateServiceTaskRepo(
        supabase as unknown as Parameters<typeof updateServiceTaskRepo>[0],
        taskId,
        patch
      );
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.updateServiceTask', result.reason, { taskId, patch });
      }
      return result;
    },
    async listServices(organizationId: string): Promise<Array<{ id: string; name: string }>> {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name');
      if (error) {
        throw new Error(`listServices failed: ${error.message}`);
      }
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  };
}

export function createPriceSheetStandardDurationRepository() {
  return {
    async get(organizationId: string) {
      return getStandardDuration(
        supabase as unknown as Parameters<typeof getStandardDuration>[0],
        organizationId
      );
    },
    async upsert(organizationId: string, standardMinutes: number) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('price_sheet_standard_duration.upsert', occurredAt, { organizationId, standardMinutes });
      const result = await upsertStandardDuration(
        supabase as unknown as Parameters<typeof upsertStandardDuration>[0],
        organizationId,
        standardMinutes
      );
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.upsertStandardDuration', result.reason, { organizationId, standardMinutes });
      }
      return result;
    },
  };
}

/* ------------------------------------------------------------------ *
 * ReimbursementRepo
 * ------------------------------------------------------------------ */

export function createReimbursementsRepository(): ReimbursementRepo {
  return {
    async listForOrganization(organizationId: string) {
      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      return ((data ?? []) as ReimbursementRow[]).map(toReimbursement);
    },

    async getById(reimbursementId: string) {
      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('id', reimbursementId)
        .maybeSingle();
      if (error) {
        throw new Error(`getById failed: ${error.message}`);
      }
      return data ? toReimbursement(data as ReimbursementRow) : null;
    },

    async approve(input: ApproveReimbursementInput) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('reimbursement.approve', occurredAt, input);
      const result = await approveReimbursementViaRpc(supabase as unknown as Parameters<typeof approveReimbursementViaRpc>[0], input);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.approveReimbursement', result.reason, { input });
      }
      return result;
    },

    async reject(input: RejectReimbursementInput) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('reimbursement.reject', occurredAt, input);
      const result = await rejectReimbursementViaRpc(supabase as unknown as Parameters<typeof rejectReimbursementViaRpc>[0], input);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.rejectReimbursement', result.reason, { input });
      }
      return result;
    },
  };
}

/* ------------------------------------------------------------------ *
 * PayoutBatchRepo
 * ------------------------------------------------------------------ */

export function createPayoutBatchesRepository(): PayoutBatchRepo {
  async function fetchLinesForBatchIds(batchIds: string[]): Promise<PayoutLineRow[]> {
    if (batchIds.length === 0) {
      return [];
    }
    const { data, error } = await supabase.from('payout_lines').select('*').in('payout_batch_id', batchIds);
    if (error) {
      throw new Error(`fetchLinesForBatchIds failed: ${error.message}`);
    }
    return (data ?? []) as PayoutLineRow[];
  }

  return {
    async listForOrganization(organizationId: string) {
      const { data, error } = await supabase
        .from('payout_batches')
        .select('*')
        .eq('organization_id', organizationId)
        .order('period_start', { ascending: false });
      if (error) {
        throw new Error(`listForOrganization failed: ${error.message}`);
      }
      const batchRows = (data ?? []) as PayoutBatchRow[];
      const lineRows = await fetchLinesForBatchIds(batchRows.map((row) => row.id));
      return batchRows.map((batchRow) =>
        toPayoutBatch(
          batchRow,
          lineRows.filter((lineRow) => lineRow.payout_batch_id === batchRow.id),
        ),
      );
    },

    async getById(batchId: string) {
      const { data, error } = await supabase
        .from('payout_batches')
        .select('*')
        .eq('id', batchId)
        .maybeSingle();
      if (error) {
        throw new Error(`getById failed: ${error.message}`);
      }
      if (!data) {
        return null;
      }
      const lineRows = await fetchLinesForBatchIds([batchId]);
      return toPayoutBatch(data as PayoutBatchRow, lineRows);
    },

    async persist(batch: PayoutBatch) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('payout_batch.persist', occurredAt, batch);
      const result = await persistPayoutBatchViaRpc(supabase as unknown as Parameters<typeof persistPayoutBatchViaRpc>[0], batch);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.persistPayoutBatch', result.reason, { batch });
      }
      return result;
    },

    async approve(batchId: string) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('payout_batch.approve', occurredAt, { batchId });

      const { data, error } = await supabase
        .from('payout_batches')
        .update({ status: 'approved' })
        .eq('id', batchId)
        .select('*')
        .single();
      if (error || !data) {
        logSyncFailure('admin-finance-repos.approvePayoutBatch', error?.message ?? 'no row returned', { batchId });
        return { ok: false, reason: error?.message ?? 'Approve failed: no row returned.' };
      }

      const lineRows = await fetchLinesForBatchIds([batchId]);
      return { ok: true, value: toPayoutBatch(data as PayoutBatchRow, lineRows) };
    },

    async markPaid(batchId: string) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('payout_batch.mark_paid', occurredAt, { batchId });

      const { data, error } = await supabase
        .from('payout_batches')
        .update({ status: 'paid' })
        .eq('id', batchId)
        .select('*')
        .single();
      if (error || !data) {
        logSyncFailure('admin-finance-repos.markPaidPayoutBatch', error?.message ?? 'no row returned', { batchId });
        return { ok: false, reason: error?.message ?? 'Mark paid failed: no row returned.' };
      }

      const lineRows = await fetchLinesForBatchIds([batchId]);
      return { ok: true, value: toPayoutBatch(data as PayoutBatchRow, lineRows) };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Close-out photos/notes (Rule 38 Slice 2 — thin CRUD over the
 * already-shipped `job_photos`/`job_notes` tables,
 * `app/supabase/0007_field_tech_tables.sql`). Both tables require a
 * NOT NULL `organization_id`; `job_photos` additionally requires a NOT
 * NULL `tech_id`. Neither is carried by the port method signatures
 * (`add(jobId, uri)` / `upsert(jobId, notes)`), so both are resolved
 * from the injected `getModuleSession()` (`../../../../modules/admin-finance/src/lib/module-session`)
 * — the host is the only legal source for admin-finance's ambient
 * org/user context, per that module's own doc comment on the
 * host-to-module read direction. Fail-closed: throws if no session is
 * injected yet, matching `getModulePorts()`'s fail-closed discipline.
 * `kind` defaults to `'after'` for close-out photos and
 * `'admin_correction'` for close-out notes — both are admin-side
 * close-out-review writes, the closest match to each column's check
 * constraint (`before|after|receipt|damage` / `decline_reason|quality_notes|dispute|admin_correction`).
 * ------------------------------------------------------------------ */

function requireModuleSession(): { organizationId: string; userId: string } {
  const session = getModuleSession();
  if (session === null) {
    throw new Error(
      'admin-finance-repos: no module session injected — the host must call setModuleSession() before close-out photo/note writes.',
    );
  }
  return { organizationId: session.org.id, userId: session.userId };
}

export function createCloseOutPhotosRepository(): JobPhotoRepository {
  return {
    async listForJob(jobId: string): Promise<CloseOutPhoto[]> {
      const { data, error } = await supabase
        .from('job_photos')
        .select('id, storage_path')
        .eq('job_id', jobId);
      if (error) {
        throw new Error(`listForJob failed: ${error.message}`);
      }
      return ((data ?? []) as Array<{ id: string; storage_path: string }>).map((row) => ({
        id: row.id,
        uri: row.storage_path,
      }));
    },

    async add(jobId: string, uri: string): Promise<CloseOutPhoto> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_photo.add', occurredAt, { jobId, uri });

      const { data, error } = await supabase
        .from('job_photos')
        .insert({
          organization_id: organizationId,
          job_id: jobId,
          tech_id: userId,
          kind: 'after',
          storage_path: uri,
          occurred_at: occurredAt,
        })
        .select('id, storage_path')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.addCloseOutPhoto', error.message, { jobId, uri });
        throw new Error(`add close-out photo failed: ${error.message}`);
      }
      const row = data as { id: string; storage_path: string };
      return { id: row.id, uri: row.storage_path };
    },

    async remove(photoId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_photo.remove', occurredAt, { photoId });

      const { error } = await supabase.from('job_photos').delete().eq('id', photoId);
      if (error) {
        logSyncFailure('admin-finance-repos.removeCloseOutPhoto', error.message, { photoId });
        throw new Error(`remove close-out photo failed: ${error.message}`);
      }
    },
  };
}

export function createCloseOutNotesRepository(): JobNoteRepository {
  return {
    async getForJob(jobId: string): Promise<string> {
      const { data, error } = await supabase
        .from('job_notes')
        .select('body')
        .eq('job_id', jobId)
        .eq('kind', 'admin_correction')
        .maybeSingle();
      if (error) {
        throw new Error(`getForJob failed: ${error.message}`);
      }
      return (data as { body: string } | null)?.body ?? '';
    },

    async upsert(jobId: string, notes: string): Promise<void> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_note.upsert', occurredAt, { jobId, notes });

      const { data: existing, error: selectError } = await supabase
        .from('job_notes')
        .select('id')
        .eq('job_id', jobId)
        .eq('kind', 'admin_correction')
        .maybeSingle();
      if (selectError) {
        logSyncFailure('admin-finance-repos.upsertCloseOutNote', selectError.message, { jobId, notes });
        throw new Error(`upsert close-out note failed: ${selectError.message}`);
      }

      if (existing) {
        const { error } = await supabase
          .from('job_notes')
          .update({ body: notes, occurred_at: occurredAt })
          .eq('id', (existing as { id: string }).id);
        if (error) {
          logSyncFailure('admin-finance-repos.upsertCloseOutNote', error.message, { jobId, notes });
          throw new Error(`upsert close-out note failed: ${error.message}`);
        }
        return;
      }

      const { error } = await supabase.from('job_notes').insert({
        organization_id: organizationId,
        job_id: jobId,
        tech_id: userId,
        kind: 'admin_correction',
        body: notes,
        occurred_at: occurredAt,
      });
      if (error) {
        logSyncFailure('admin-finance-repos.upsertCloseOutNote', error.message, { jobId, notes });
        throw new Error(`upsert close-out note failed: ${error.message}`);
      }
    },
  };
}

export function createCloseOutContactLogRepository(): JobContactLogRepository {
  return {
    async listForJob(jobId: string): Promise<JobContactLogEntry[]> {
      const { data, error } = await supabase
        .from('job_contact_log')
        .select('id, organization_id, job_id, contact_type, note, contacted_by, created_at')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });
      if (error) {
        throw new Error(`listForJob failed: ${error.message}`);
      }
      return (data as Array<{
        id: number;
        organization_id: string;
        job_id: string;
        contact_type: 'phone' | 'text' | 'email' | 'other';
        note: string | null;
        contacted_by: string | null;
        created_at: string;
      }>).map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        jobId: row.job_id,
        contactType: row.contact_type,
        note: row.note,
        contactedBy: row.contacted_by,
        createdAt: row.created_at,
      }));
    },

    async create(
      jobId: string,
      organizationId: string,
      contactType: 'phone' | 'text' | 'email' | 'other',
      note: string | null,
    ): Promise<JobContactLogEntry> {
      const { userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_contact_log.create', occurredAt, { jobId, organizationId, contactType, note });

      const { data, error } = await supabase
        .from('job_contact_log')
        .insert({
          organization_id: organizationId,
          job_id: jobId,
          contact_type: contactType,
          note,
          contacted_by: userId,
        })
        .select('id, organization_id, job_id, contact_type, note, contacted_by, created_at')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.createCloseOutContactLog', error.message, { jobId, contactType, note });
        throw new Error(`create close-out contact log entry failed: ${error.message}`);
      }
      const row = data as {
        id: number;
        organization_id: string;
        job_id: string;
        contact_type: 'phone' | 'text' | 'email' | 'other';
        note: string | null;
        contacted_by: string | null;
        created_at: string;
      };
      return {
        id: row.id,
        organizationId: row.organization_id,
        jobId: row.job_id,
        contactType: row.contact_type,
        note: row.note,
        contactedBy: row.contacted_by,
        createdAt: row.created_at,
      };
    },
  };
}

export function createCloseOutFailuresRepository(): CloseOutFailureRepository {
  const OPEN_STATUSES = ['open', 'retrying'] as const;

  async function fetchOpenFailureRow(jobId: string) {
    const { data, error } = await supabase
      .from('close_out_failures')
      .select(
        'id, organization_id, job_id, stage, reason, status, attempts, last_attempted_at, resolved_by, resolved_at, resolution_note, created_at, updated_at',
      )
      .eq('job_id', jobId)
      .in('status', OPEN_STATUSES as unknown as string[])
      .maybeSingle();
    if (error) {
      logSyncFailure('admin-finance-repos.closeOutFailures.fetchOpenFailureRow', error.message, { jobId });
      throw new Error(`fetch open close-out failure failed: ${error.message}`);
    }
    return data as CloseOutFailureRow | null;
  }

  return {
    async recordFailure(
      organizationId: string,
      jobId: string,
      stage: CloseOutFailureStage,
      reason: string,
    ): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('close_out_failures.recordFailure', occurredAt, { organizationId, jobId, stage, reason });

      const existing = await fetchOpenFailureRow(jobId);

      if (existing) {
        const { error } = await supabase
          .from('close_out_failures')
          .update({ stage, reason, updated_at: occurredAt })
          .eq('id', existing.id);
        if (error) {
          logSyncFailure('admin-finance-repos.closeOutFailures.recordFailure', error.message, { jobId, stage, reason });
          throw new Error(`update close-out failure failed: ${error.message}`);
        }
        return;
      }

      const { error } = await supabase.from('close_out_failures').insert({
        organization_id: organizationId,
        job_id: jobId,
        stage,
        reason,
        status: 'open',
      });
      if (error) {
        logSyncFailure('admin-finance-repos.closeOutFailures.recordFailure', error.message, { jobId, stage, reason });
        throw new Error(`record close-out failure failed: ${error.message}`);
      }
    },

    async recordAttempt(jobId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('close_out_failures.recordAttempt', occurredAt, { jobId });

      const existing = await fetchOpenFailureRow(jobId);
      if (!existing) {
        throw new Error(`recordAttempt: no open close-out failure found for job ${jobId}`);
      }

      const { error } = await supabase
        .from('close_out_failures')
        .update({
          attempts: existing.attempts + 1,
          last_attempted_at: occurredAt,
          status: 'retrying',
          updated_at: occurredAt,
        })
        .eq('id', existing.id);
      if (error) {
        logSyncFailure('admin-finance-repos.closeOutFailures.recordAttempt', error.message, { jobId });
        throw new Error(`record close-out failure attempt failed: ${error.message}`);
      }
    },

    // 'resolved_manual' routes through resolve_close_out_failure_manual (0023) —
    // admin-gated, security definer, uses auth.uid() as resolver internally, so
    // the passed resolvedBy is not sent (kept in the signature to match the
    // port). 'resolved_retry' has no dedicated RPC outside the atomic
    // close_out_job_write path (0026), so it is written directly here,
    // matching the fail-closed direct-write pattern used by neighboring repos.
    async resolve(
      jobId: string,
      resolution: 'resolved_retry' | 'resolved_manual',
      resolvedBy: string,
      note?: string,
    ): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('close_out_failures.resolve', occurredAt, { jobId, resolution, resolvedBy, note });

      const existing = await fetchOpenFailureRow(jobId);
      if (!existing) {
        throw new Error(`resolve: no open close-out failure found for job ${jobId}`);
      }

      if (resolution === 'resolved_manual') {
        const { error } = await supabase.rpc('resolve_close_out_failure_manual', {
          p_failure_id: existing.id,
          p_note: note ?? null,
        });
        if (error) {
          logSyncFailure('admin-finance-repos.closeOutFailures.resolve', error.message, { jobId, resolution });
          throw new Error(`resolve close-out failure (manual) failed: ${error.message}`);
        }
        return;
      }

      const { error } = await supabase
        .from('close_out_failures')
        .update({
          status: 'resolved_retry',
          resolved_by: resolvedBy,
          resolved_at: occurredAt,
          resolution_note: note ?? null,
          updated_at: occurredAt,
        })
        .eq('id', existing.id);
      if (error) {
        logSyncFailure('admin-finance-repos.closeOutFailures.resolve', error.message, { jobId, resolution });
        throw new Error(`resolve close-out failure (retry) failed: ${error.message}`);
      }
    },

    async listNeedingAttention(organizationId: string): Promise<CloseOutFailureRecord[]> {
      const { data, error } = await supabase
        .from('close_out_failures')
        .select(
          'id, organization_id, job_id, stage, reason, status, attempts, last_attempted_at, resolved_by, resolved_at, resolution_note, created_at, updated_at',
        )
        .eq('organization_id', organizationId)
        .in('status', OPEN_STATUSES as unknown as string[])
        .order('created_at', { ascending: false });
      if (error) {
        logSyncFailure('admin-finance-repos.closeOutFailures.listNeedingAttention', error.message, { organizationId });
        throw new Error(`list close-out failures failed: ${error.message}`);
      }
      return (data as CloseOutFailureRow[]).map(toCloseOutFailure);
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
 * TechServiceAreaRepository
 * ------------------------------------------------------------------ */

export function createTechServiceAreaRepository(): TechServiceAreaRepository {
  return {
    async listForOrganization(organizationId: string) {
      const result = await listTechServiceAreas(supabase, organizationId);
      if (!result.ok) {
        throw new Error(`listForOrganization failed: ${result.reason}`);
      }
      return result.value;
    },

    async assignToTech(organizationId: string, techId: string, serviceAreaId: string): Promise<void> {
      const { error } = await supabase.from('tech_service_areas').upsert(
        {
          organization_id: organizationId,
          tech_id: techId,
          service_area_id: serviceAreaId,
        },
        { onConflict: 'tech_id,service_area_id' }
      );
      if (error) {
        throw new Error(`assignToTech failed: ${error.message}`);
      }
    },

    async removeFromTech(organizationId: string, techId: string, serviceAreaId: string): Promise<void> {
      const { error } = await supabase
        .from('tech_service_areas')
        .delete()
        .eq('organization_id', organizationId)
        .eq('tech_id', techId)
        .eq('service_area_id', serviceAreaId);
      if (error) {
        throw new Error(`removeFromTech failed: ${error.message}`);
      }
    },
  };
}

function createTechSkillRepository(): TechSkillRepository {
  return {
    async listForOrganization(organizationId: string) {
      const result = await listTechSkills(supabase, organizationId);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      return result.value;
    },
    async assignToTech(organizationId: string, techId: string, skill: string) {
      const { error } = await supabase.from('tech_skills').upsert(
        {
          organization_id: organizationId,
          tech_id: techId,
          skill,
        },
        { onConflict: 'tech_id,skill' }
      );
      if (error) {
        throw new Error(error.message);
      }
    },
    async removeFromTech(organizationId: string, techId: string, skill: string) {
      const { error } = await supabase
        .from('tech_skills')
        .delete()
        .eq('organization_id', organizationId)
        .eq('tech_id', techId)
        .eq('skill', skill);
      if (error) {
        throw new Error(error.message);
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * ServiceAreaRepository
 * ------------------------------------------------------------------ */

export function createServiceAreaRepository(): ServiceAreaRepository {
  return {
    async listForOrganization(organizationId: string) {
      const result = await listServiceAreas(supabase, organizationId);
      if (!result.ok) {
        throw new Error(`listForOrganization failed: ${result.reason}`);
      }
      return result.value;
    },
  };
}

/* ------------------------------------------------------------------ *
 * PaymentsRepository (Workstream D — folded in from the retired
 * payment-review module). Mirrors createAuditLogRepository's shape for
 * its read methods (maps rows via toPayment, which throws on an
 * unrecognized status — fail closed); recordManualPayment is the one
 * write path, used by the Job Details screen's manual "Mark Paid"
 * action. It always inserts provider_id: 'manual' and leaves
 * external_ref null — this table may never hold a card number, PAN,
 * CVV, or any token that could be one.
 * ------------------------------------------------------------------ */

export function createPaymentsRepository(): PaymentsRepository {
  return {
    async listNeedingAttention(organizationId: string): Promise<Payment[]> {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'failed']);
      if (error) {
        throw new Error(`listNeedingAttention failed: ${error.message}`);
      }
      return ((data ?? []) as PaymentRow[]).map(toPayment);
    },
    async listManuallyConfirmed(organizationId: string): Promise<Payment[]> {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'manual_confirmed');
      if (error) {
        throw new Error(`listManuallyConfirmed failed: ${error.message}`);
      }
      return ((data ?? []) as PaymentRow[]).map(toPayment);
    },
    async listForJob(jobId: string): Promise<Payment[]> {
      const { data, error } = await supabase.from('payments').select('*').eq('job_id', jobId);
      if (error) {
        throw new Error(`list job payments failed: ${error.message}`);
      }
      return ((data ?? []) as PaymentRow[]).map(toPayment);
    },
    async recordManualPayment(organizationId: string, jobId: string, amount: number): Promise<Payment> {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error(`record manual payment failed to resolve current user: ${userError?.message ?? 'no session'}`);
      }

      const { data, error } = await supabase
        .from('payments')
        .insert({
          organization_id: organizationId,
          job_id: jobId,
          provider_id: 'manual',
          amount,
          status: 'manual_confirmed',
          external_ref: null,
          confirmed_at: new Date().toISOString(),
          confirmed_by: userData.user.id,
        })
        .select('*')
        .single();
      if (error || !data) {
        logSyncFailure('admin-finance-repos.recordManualPayment', error?.message ?? 'no row returned', { organizationId, jobId, amount });
        throw new Error(`record manual payment failed: ${error?.message ?? 'no row returned'}`);
      }
      return toPayment(data as PaymentRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * CalendarEventRepository
 * ------------------------------------------------------------------ */

export function createCalendarEventRepository(): CalendarEventRepository {
  return {
    async create(organizationId: string, draft: CalendarEventDraft): Promise<void> {
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
        logSyncFailure('admin-finance-repos.createCalendarEvent', error.message, { organizationId, draft });
        throw new Error(`create calendar event failed: ${error.message}`);
      }
    },

    async logTransition(
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
 * TimeOffAdminRepo (Workstream F, 4b)
 * ------------------------------------------------------------------ */

/**
 * Direct-write admin implementation: `time_off_requests_admin_all` RLS
 * (`app/supabase/0007_field_tech_tables.sql` L280-284) already grants org
 * admins full read/write on `time_off_requests`. Approve/deny are no longer
 * exposed here — a database trigger auto-decides each request.
 */
export function createTimeOffAdminRepository(): TimeOffAdminRepo {
  return {
    async listForOrganization(organizationId: string) {
      const { data, error } = await supabase
        .from('time_off_requests')
        .select('id, organization_id, tech_id, start_date, end_date, reason, status, created_at, updated_at, created_by_admin_id')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) {
        logSyncFailure('admin-finance-repos.listTimeOffForOrganization', error.message, { organizationId });
        throw new Error(`list time off requests failed: ${error.message}`);
      }
      return ((data ?? []) as TimeOffRequestAdminRow[]).map(toTimeOffRequestAdmin);
    },

    async createBlackout(
      organizationId: string,
      techId: string,
      draft: { startDate: string; endDate: string; reason: string | null },
    ) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error(`create time off blackout failed to resolve current user: ${userError?.message ?? 'no session'}`);
      }
      const occurredAt = new Date().toISOString();
      await enqueueMutation('time_off_request.create_blackout', occurredAt, { organizationId, techId, draft });

      const { data, error } = await supabase
        .from('time_off_requests')
        .insert({
          organization_id: organizationId,
          tech_id: techId,
          start_date: draft.startDate,
          end_date: draft.endDate,
          reason: draft.reason,
          created_by_admin_id: userData.user.id,
        })
        .select('id, organization_id, tech_id, start_date, end_date, reason, status, created_at, updated_at, created_by_admin_id')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.createTimeOffBlackout', error.message, { organizationId, techId, draft });
        throw new Error(`create time off blackout failed: ${error.message}`);
      }
      return toTimeOffRequestAdmin(data as TimeOffRequestAdminRow);
    },

    async cancel(requestId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('time_off_request.cancel', occurredAt, { requestId });

      const { error } = await supabase
        .from('time_off_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);
      if (error) {
        logSyncFailure('admin-finance-repos.cancelTimeOffRequest', error.message, { requestId });
        throw new Error(`cancel time off request failed: ${error.message}`);
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * CustomerRepository
 * ------------------------------------------------------------------ */

export function createCustomerRepository(): CustomerRepository {
  return {
    async getById(id: string): Promise<Customer | null> {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        throw new Error(`getById failed: ${error.message}`);
      }
      return data ? toCustomer(data as CustomerRow) : null;
    },

    async create(input: CustomerCreateInput): Promise<Customer> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('customer.create', occurredAt, input);

      const { data, error } = await supabase
        .from('customers')
        .insert({
          organization_id: input.organizationId,
          name: input.name,
          phone: input.phone,
          email: input.email,
          address: input.address,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.createCustomer', error.message, { input });
        throw new Error(`create customer failed: ${error.message}`);
      }
      return toCustomer(data as CustomerRow);
    },

    async update(id: string, patch: CustomerPatch): Promise<Customer> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('customer.update', occurredAt, { id, patch });

      const { data, error } = await supabase
        .from('customers')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.updateCustomer', error.message, { id, patch });
        throw new Error(`update customer failed: ${error.message}`);
      }
      return toCustomer(data as CustomerRow);
    },

    async saveForJob(jobId: string, patch: CustomerPatch): Promise<Customer> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('customer.saveForJob', occurredAt, { jobId, patch });

      const { data, error } = await supabase.rpc('save_job_customer', {
        p_job_id: jobId,
        p_customer: patch,
      });
      if (error) {
        logSyncFailure('admin-finance-repos.saveForJobCustomer', error.message, { jobId, patch });
        throw new Error(`saveForJob customer failed: ${error.message}`);
      }
      return toCustomer(data as CustomerRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobPlanningRepository / JobPlanningPhotoRepository
 * ------------------------------------------------------------------ */

function toJobPlanningDetails(row: {
  job_id: string;
  organization_id: string;
  model_numbers: string | null;
  parts_list: string | null;
  measurements: string | null;
  instructions: string | null;
  ingress_notes: string | null;
  logistics_notes: string | null;
  parking_notes: string | null;
  state_assessment: string | null;
  updated_at: string;
  updated_by: string | null;
}): JobPlanningDetails {
  return {
    jobId: row.job_id,
    organizationId: row.organization_id,
    modelNumbers: row.model_numbers,
    partsList: row.parts_list,
    measurements: row.measurements,
    instructions: row.instructions,
    ingressNotes: row.ingress_notes,
    logisticsNotes: row.logistics_notes,
    parkingNotes: row.parking_notes,
    stateAssessment: row.state_assessment,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export function createJobPlanningRepository(): JobPlanningRepository {
  return {
    async getForJob(jobId: string): Promise<JobPlanningDetails | null> {
      const { data, error } = await supabase
        .from('job_planning_details')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();
      if (error) {
        throw new Error(`getForJob failed: ${error.message}`);
      }
      return data ? toJobPlanningDetails(data as Parameters<typeof toJobPlanningDetails>[0]) : null;
    },

    async upsertForJob(jobId: string, details: JobPlanningDetailsInput): Promise<JobPlanningDetails> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_planning.upsert', occurredAt, { jobId, details });

      const { data, error } = await supabase
        .from('job_planning_details')
        .upsert(
          {
            job_id: jobId,
            organization_id: organizationId,
            model_numbers: details.modelNumbers,
            parts_list: details.partsList,
            measurements: details.measurements,
            instructions: details.instructions,
            ingress_notes: details.ingressNotes,
            logistics_notes: details.logisticsNotes,
            parking_notes: details.parkingNotes,
            state_assessment: details.stateAssessment,
            updated_at: occurredAt,
            updated_by: userId,
          },
          { onConflict: 'job_id' }
        )
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.upsertJobPlanning', error.message, { jobId, details });
        throw new Error(`upsertForJob failed: ${error.message}`);
      }
      return toJobPlanningDetails(data as Parameters<typeof toJobPlanningDetails>[0]);
    },
  };
}

function toJobPlanningPhoto(row: {
  id: string;
  job_id: string;
  organization_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  created_by: string | null;
}): JobPlanningPhoto {
  return {
    id: row.id,
    jobId: row.job_id,
    organizationId: row.organization_id,
    storagePath: row.storage_path,
    caption: row.caption,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export function createJobPlanningPhotoRepository(): JobPlanningPhotoRepository {
  return {
    async listForJob(jobId: string): Promise<JobPlanningPhoto[]> {
      const { data, error } = await supabase
        .from('job_planning_photos')
        .select('*')
        .eq('job_id', jobId);
      if (error) {
        throw new Error(`listForJob failed: ${error.message}`);
      }
      return ((data ?? []) as Array<Parameters<typeof toJobPlanningPhoto>[0]>).map(toJobPlanningPhoto);
    },

    async addForJob(jobId: string, photo: JobPlanningPhotoInput): Promise<JobPlanningPhoto> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_planning_photo.add', occurredAt, { jobId, photo });

      const { data, error } = await supabase
        .from('job_planning_photos')
        .insert({
          job_id: jobId,
          organization_id: organizationId,
          storage_path: photo.storagePath,
          caption: photo.caption ?? null,
          created_at: occurredAt,
          created_by: userId,
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.addJobPlanningPhoto', error.message, { jobId, photo });
        throw new Error(`addForJob failed: ${error.message}`);
      }
      return toJobPlanningPhoto(data as Parameters<typeof toJobPlanningPhoto>[0]);
    },
  };
}

/* ------------------------------------------------------------------ *
 * EstimateRepository
 * ------------------------------------------------------------------ */

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
        logSyncFailure('admin-finance-repos.upsertJobEstimate', error.message, { jobId, input });
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
        logSyncFailure('admin-finance-repos.addJobEstimateLineItem', error.message, { jobId, draft });
        throw new Error(`addLineItem failed: ${error.message}`);
      }
      return toJobEstimateLineItem(data as Parameters<typeof toJobEstimateLineItem>[0]);
    },

    async updateLineItem(lineItemId: string, patch: Partial<JobEstimateLineItemDraft>): Promise<JobEstimateLineItem> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_estimate_line_item.update', occurredAt, { lineItemId, patch });

      const updatePatch: Record<string, unknown> = {};
      if (patch.kind !== undefined) {
        updatePatch.kind = patch.kind;
      }
      if (patch.description !== undefined) {
        updatePatch.description = patch.description;
      }
      if (patch.quantity !== undefined) {
        updatePatch.quantity = patch.quantity;
      }
      if (patch.unitCost !== undefined) {
        updatePatch.unit_cost = patch.unitCost;
      }
      if (patch.lineTotal !== undefined) {
        updatePatch.line_total = patch.lineTotal;
      }

      const { data, error } = await supabase
        .from('job_estimate_line_items')
        .update(updatePatch)
        .eq('id', lineItemId)
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.updateJobEstimateLineItem', error.message, { lineItemId, patch });
        throw new Error(`updateLineItem failed: ${error.message}`);
      }
      return toJobEstimateLineItem(data as Parameters<typeof toJobEstimateLineItem>[0]);
    },

    async removeLineItem(lineItemId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_estimate_line_item.remove', occurredAt, { lineItemId });

      const { error } = await supabase.from('job_estimate_line_items').delete().eq('id', lineItemId);
      if (error) {
        logSyncFailure('admin-finance-repos.removeJobEstimateLineItem', error.message, { lineItemId });
        throw new Error(`removeLineItem failed: ${error.message}`);
      }
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
 * JobInvestigationRepository (mirrors `job_investigations`,
 * `app/supabase/0023_field_ops_segway_and_estimating.sql`; unique
 * `job_id` constraint added by `app/supabase/0038_job_investigations_unique_job.sql`
 * so `upsertForJob` can use `onConflict: 'job_id'`, same idiom as
 * `JobPlanningRepository.upsertForJob` above). Not yet declared in
 * `ports.ts` — this shape is defined locally until a `ModulePorts` slot
 * is added there.
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
  roomWork: { room: string; work: string }[];
  measurements: string | null;
  techInstructions: string | null;
  materialsArrived: boolean | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobInvestigationInput {
  techId: string;
  ingressNotes?: string | null;
  logisticsNotes?: string | null;
  parkingNotes?: string | null;
  stateAssessment?: string | null;
  roomWork?: { room: string; work: string }[];
  measurements?: string | null;
  techInstructions?: string | null;
  materialsArrived?: boolean | null;
  submittedAt?: string | null;
}

export interface JobInvestigationRepository {
  getForJob(jobId: string): Promise<JobInvestigation | null>;
  upsertForJob(jobId: string, patch: JobInvestigationInput): Promise<JobInvestigation>;
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
  room_work: { room: string; work: string }[] | null;
  measurements: string | null;
  tech_instructions: string | null;
  materials_arrived: boolean | null;
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
    measurements: row.measurements ?? null,
    techInstructions: row.tech_instructions ?? null,
    materialsArrived: row.materials_arrived ?? null,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createJobInvestigationRepository(): JobInvestigationRepository {
  return {
    async getForJob(jobId: string): Promise<JobInvestigation | null> {
      const { data, error } = await supabase
        .from('job_investigations')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();
      if (error) {
        throw new Error(`getForJob failed: ${error.message}`);
      }
      return data ? toJobInvestigation(data as Parameters<typeof toJobInvestigation>[0]) : null;
    },

    async upsertForJob(jobId: string, patch: JobInvestigationInput): Promise<JobInvestigation> {
      const { organizationId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_investigation.upsert', occurredAt, { jobId, patch });

      const { data, error } = await supabase
        .from('job_investigations')
        .upsert(
          {
            job_id: jobId,
            organization_id: organizationId,
            tech_id: patch.techId,
            ingress_notes: patch.ingressNotes ?? null,
            logistics_notes: patch.logisticsNotes ?? null,
            parking_notes: patch.parkingNotes ?? null,
            state_assessment: patch.stateAssessment ?? null,
            room_work: patch.roomWork ?? [],
            measurements: patch.measurements ?? null,
            tech_instructions: patch.techInstructions ?? null,
            materials_arrived: patch.materialsArrived ?? null,
            submitted_at: patch.submittedAt ?? null,
            updated_at: occurredAt,
          },
          { onConflict: 'job_id' }
        )
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.upsertJobInvestigation', error.message, { jobId, patch });
        throw new Error(`upsertForJob failed: ${error.message}`);
      }
      return toJobInvestigation(data as Parameters<typeof toJobInvestigation>[0]);
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobPlanTasksRepository
 * ------------------------------------------------------------------ */

function toJobPlanTaskRow(row: {
  id: string;
  job_id: string;
  service_task_id: string;
  quantity: number;
  notes: string | null;
  service_tasks: {
    name: string;
    estimated_minutes: number | null;
    rate: number | null;
    category: string | null;
    active: boolean;
  } | null;
}): JobPlanTaskRow {
  const task = row.service_tasks;
  return {
    id: row.id,
    jobId: row.job_id,
    serviceTaskId: row.service_task_id,
    quantity: row.quantity,
    notes: row.notes,
    name: task?.name ?? '',
    estimatedMinutes: task?.estimated_minutes ?? null,
    rate: task?.rate ?? null,
    category: task?.category ?? null,
    active: task?.active ?? false,
  };
}

export function createJobPlanTasksRepository(): JobPlanTasksRepository {
  return {
    async listCatalogTasks(organizationId: string): Promise<ServiceTaskCatalogEntry[]> {
      const { data, error } = await supabase
        .from('service_tasks')
        .select('id, name, category, estimated_minutes, rate, task_number')
        .eq('organization_id', organizationId)
        .eq('active', true);
      if (error) {
        throw new Error(`listCatalogTasks failed: ${error.message}`);
      }
      return ((data ?? []) as Array<{
        id: string;
        name: string;
        category: string | null;
        estimated_minutes: number | null;
        rate: number | null;
        task_number: number | null;
      }>).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        estimatedMinutes: row.estimated_minutes,
        rate: row.rate,
        taskNumber: row.task_number ?? null,
      }));
    },

    async listServices(organizationId: string): Promise<Array<{ id: string; name: string }>> {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name');
      if (error) {
        throw new Error(`listServices failed: ${error.message}`);
      }
      return (data ?? []) as Array<{ id: string; name: string }>;
    },

    async listForJob(jobId: string): Promise<JobPlanTaskRow[]> {
      const { data, error } = await supabase
        .from('job_plan_tasks')
        .select('*, service_tasks(name, estimated_minutes, rate, category, active)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) {
        throw new Error(`listForJob failed: ${error.message}`);
      }
      return ((data ?? []) as Array<Parameters<typeof toJobPlanTaskRow>[0]>).map(toJobPlanTaskRow);
    },

    async addTask(jobId: string, serviceTaskId: string, quantity: number): Promise<JobPlanTaskRow> {
      const { organizationId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_plan_task.add', occurredAt, { jobId, serviceTaskId, quantity });

      const { data, error } = await supabase
        .from('job_plan_tasks')
        .insert({
          organization_id: organizationId,
          job_id: jobId,
          service_task_id: serviceTaskId,
          quantity,
        })
        .select('*, service_tasks(name, estimated_minutes, rate, category, active)')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.addJobPlanTask', error.message, { jobId, serviceTaskId, quantity });
        throw new Error(`addTask failed: ${error.message}`);
      }
      return toJobPlanTaskRow(data as Parameters<typeof toJobPlanTaskRow>[0]);
    },

    async updateQuantity(taskRowId: string, quantity: number): Promise<JobPlanTaskRow> {
      const { userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_plan_task.update_quantity', occurredAt, { taskRowId, quantity });

      const { data, error } = await supabase
        .from('job_plan_tasks')
        .update({ quantity, updated_at: occurredAt, updated_by: userId })
        .eq('id', taskRowId)
        .select('*, service_tasks(name, estimated_minutes, rate, category, active)')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.updateJobPlanTaskQuantity', error.message, { taskRowId, quantity });
        throw new Error(`updateQuantity failed: ${error.message}`);
      }
      return toJobPlanTaskRow(data as Parameters<typeof toJobPlanTaskRow>[0]);
    },

    async removeTask(taskRowId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job_plan_task.remove', occurredAt, { taskRowId });

      const { error } = await supabase.from('job_plan_tasks').delete().eq('id', taskRowId);
      if (error) {
        logSyncFailure('admin-finance-repos.removeJobPlanTask', error.message, { taskRowId });
        throw new Error(`removeTask failed: ${error.message}`);
      }
    },
  };
}

export function createTimeEntryRepository(): TimeEntryRepository {
  return {
    async listForEmployee(profileId: string): Promise<TimeEntry[]> {
      const { data, error } = await supabase
        .from('job_time_entries')
        .select('*')
        .eq('tech_id', profileId)
        .order('clock_in_at', { ascending: false });
      if (error) {
        throw new Error(`listForEmployee failed: ${error.message}`);
      }
      return ((data ?? []) as TimeEntryRow[]).map(toTimeEntry);
    },
  };
}

/* ------------------------------------------------------------------ *
 * ModulePorts aggregator
 * ------------------------------------------------------------------ */

let cachedPorts: ModulePorts | null = null;

export function buildAdminFinancePorts(): ModulePorts {
  if (cachedPorts) {
    return cachedPorts;
  }
  cachedPorts = {
    jobs: createJobRepository(),
    priceSheets: createPriceSheetRepository(),
    payPeriods: createPayPeriodRepository(),
    leads: createLeadRepository(),
    employees: createEmployeeRepository(),
    invitations: createInvitationRepository(),
    jobAssignments: createJobAssignmentRepository(),
    commissions: createCommissionRepository(),
    auditLog: createAuditLogRepository(),
    priceSheetPublish: createPriceSheetPublishRepository(),
    priceSheetAreaAdjustments: createPriceSheetAreaAdjustmentsRepository(),
    priceSheetRates: createPriceSheetRatesRepository(),
    serviceTasks: createServiceTasksRepository(),
    reimbursements: createReimbursementsRepository(),
    payoutBatches: createPayoutBatchesRepository(),
    closeOutFailures: createCloseOutFailuresRepository(),
    closeOutPhotos: createCloseOutPhotosRepository(),
    closeOutNotes: createCloseOutNotesRepository(),
    closeOutContactLog: createCloseOutContactLogRepository(),
    payments: createPaymentsRepository(),
    calendarEvents: createCalendarEventRepository(),
    timeOffAdmin: createTimeOffAdminRepository(),
    techServiceAreas: createTechServiceAreaRepository(),
    techSkills: createTechSkillRepository(),
    serviceAreas: createServiceAreaRepository(),
    customers: createCustomerRepository(),
    jobPlanning: createJobPlanningRepository(),
    jobPlanningPhotos: createJobPlanningPhotoRepository(),
    estimates: createEstimateRepository(),
    investigations: createJobInvestigationRepository(),
    jobPlanTasks: createJobPlanTasksRepository(),
    timeEntries: createTimeEntryRepository(),
    paymentReview: {
      ReconciliationView,
      client: supabase as unknown as PaymentReviewClient,
    },
    localPrefs: {
      getBool: getBoolPref,
      setBool: setBoolPref,
    },
  };
  return cachedPorts;
}
