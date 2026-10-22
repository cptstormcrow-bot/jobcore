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
import { createPayrollRepos, type PayrollRepoSession } from './payroll-repos';
import { buildPayrollAdminMembers } from './payroll-admin-repos';
import { ReconciliationView } from '@jobcore/payment-review';
import type { SupabaseSelectClient as PaymentReviewClient } from '@jobcore/payment-review';
import type { CalculationResult } from '../../../../modules/admin-finance/src/money/types';
import type { PostgrestError } from '@supabase/supabase-js';
import { writeThrough, requireOnline } from './offline-mutations';
import { newClientId } from './ids';
import { isOnlineNow } from './sync-events';
import { copyToLocal, storagePathFor, planningStoragePathFor } from './photo-files';
import { resolvePhotoUri } from './signed-url-cache';
import { cachedRead, getReadCacheIdentity, buildReadCacheKey } from './read-cache';
import { logSyncFailure } from './log';
import { getBoolPref, setBoolPref } from './local-prefs';
import { setOnlineGuard } from '../../../../modules/admin-finance/src/lib/online';
import { setOnlineGuard as setPaymentReviewOnlineGuard } from '../../../../modules/payment-review/src/lib/online';
import type { Job, Commission, JobStatus, Profile, Role, VehicleStatus, ToolStatus } from '@jobcore/core';
import type {
  JobRepository,
  JobCardExtrasRepository,
  JobCardFlags,
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
  PaymentMethod,
  CalendarEventRepository,
  CalendarEventDraft,
  TechServiceAreaRepository,
  ServiceAreaRepository,
  CustomerRow,
  Customer,
  CustomerRepository,
  CustomerContact,
  CustomerJobHistoryItem,
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
import { buildJobTimeline } from '../../../../modules/admin-finance/src/domain/job-timeline';
import type { JobTimelineItem, JobTimelineSources } from '../../../../modules/admin-finance/src/domain/job-timeline';
import type { JobTimelineRepository } from '../../../../modules/admin-finance/src/data/ports';
import type { PriceSheet, CompensationPolicy } from '../../../../modules/admin-finance/src/money/types';
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
import { toReimbursement, approveReimbursementViaRpc, rejectReimbursementViaRpc, markReimbursementPaidViaRpc } from '../../../../modules/admin-finance/src/data/reimbursement-repo';
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
  // NEVER include `id`: audit_log.id is a bigint identity; replay key is idempotency_key.
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
  requireOnline('close out the job');
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

/**
 * Cache-first read through the offline read cache (S6); keys `af.<group>.<fn>`. Mirrors
 * field-tech-repos.ts readCached; live fetch until the cache identity exists (pre-auth).
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

/** Jobs last seen this session; used only to build optimistic values for write-through ops. */
const knownJobs = new Map<string, Job>();
function rememberJob(job: Job): Job {
  knownJobs.set(job.id, job);
  return job;
}

/** Leads last seen this session; used only to build optimistic values for write-through ops. */
const knownLeads = new Map<string, Lead>();
function rememberLead(lead: Lead): Lead {
  knownLeads.set(lead.id, lead);
  return lead;
}

export function createJobRepository(): JobRepository {
  return {
    async listForOrganization(organizationId: string): Promise<Job[]> {
      return readCached('af.jobs.listForOrganization', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, customers(name)')
          .eq('organization_id', organizationId);
        if (error) {
          throw new Error(`listForOrganization failed: ${error.message}`);
        }
        return ((data ?? []) as JobRow[]).map(toJob).map(rememberJob);
      });
    },

    async getById(jobId: string): Promise<Job | null> {
      return readCached('af.jobs.getById', { jobId }, async () => {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .maybeSingle();
        if (error) {
          throw new Error(`getById failed: ${error.message}`);
        }
        return data ? rememberJob(toJob(data as JobRow)) : null;
      });
    },

    async patchScheduling(jobId: string, patch: JobSchedulingPatch): Promise<Job> {
      const occurredAt = new Date().toISOString();
      const optimistic = { ...(knownJobs.get(jobId) ?? { id: jobId }), ...patch } as never as Job;
      const res = await writeThrough('job.patch_scheduling', { jobId, patch }, occurredAt, optimistic);
      return rememberJob(res.data);
    },

    async patchLifecycle(jobId: string, patch: JobLifecyclePatch): Promise<Job> {
      const occurredAt = new Date().toISOString();
      const optimistic = { ...(knownJobs.get(jobId) ?? { id: jobId }), ...patch } as never as Job;
      const res = await writeThrough('job.patch_lifecycle', { jobId, patch }, occurredAt, optimistic);
      return rememberJob(res.data);
    },

    async markBeta(jobId: string, isBeta: boolean): Promise<void> {
      const occurredAt = new Date().toISOString();
      await writeThrough('job.mark_beta', { jobId, isBeta }, occurredAt, undefined);
    },

    async setNeedsPrem(jobId: string, at: string | null): Promise<void> {
      await writeThrough('job.set_needs_prem', { jobId, at }, new Date().toISOString(), undefined);
    },

    async clearInvestigator(jobId: string): Promise<void> {
      await writeThrough('job_assignment.remove_investigator', { jobId }, new Date().toISOString(), undefined);
    },

    async resetTimeline(jobId: string): Promise<void> {
      await writeThrough('job.reset_timeline', { jobId }, new Date().toISOString(), undefined);
    },

    async resetTimeSegments(jobId: string): Promise<void> {
      requireOnline('reset the job time segments');
      const { error } = await supabase.rpc('reset_job_time_segments', { p_job_id: jobId });
      if (error) {
        throw new Error(`resetTimeSegments failed: ${error.message}`);
      }
    },

    async updateDetails(jobId: string, patch: JobDetailsPatch): Promise<Job> {
      const occurredAt = new Date().toISOString();
      const optimistic = { ...(knownJobs.get(jobId) ?? { id: jobId }), ...patch } as never as Job;
      const res = await writeThrough('job.update_details', { jobId, patch }, occurredAt, optimistic);
      return rememberJob(res.data);
    },

    async create(draft: JobDraft): Promise<Job> {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = { ...(draft as object), id, createdAt: occurredAt } as never as Job;
      const res = await writeThrough('job.create', { id, draft }, occurredAt, optimistic);
      return rememberJob(res.data);
    },

    async updateStatus(jobId: string, status: JobStatus): Promise<Job> {
      const occurredAt = new Date().toISOString();
      const optimistic = { ...(knownJobs.get(jobId) ?? { id: jobId }), status } as never as Job;
      const res = await writeThrough('job.update_status', { jobId, status }, occurredAt, optimistic);
      return rememberJob(res.data);
    },

    async closeOutWrite(
      jobId: string,
      fromStatus: JobStatus,
      commission: CommissionLine,
      closedByUserId: string,
    ): Promise<Job> {
      // Online-only (W0): no queue entry; closeOutJobWriteViaRpc calls requireOnline.
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
      return readCached('af.priceSheets.listForOrganization', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('price_sheets')
          .select('*')
          .eq('organization_id', organizationId);
        if (error) {
          throw new Error(`listForOrganization failed: ${error.message}`);
        }
        return ((data ?? []) as PriceSheetRow[]).map(toPriceSheet);
      });
    },

    async getActive(organizationId: string): Promise<PriceSheet | null> {
      return readCached('af.priceSheets.getActive', { organizationId }, async () => {
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
      });
    },

    async create(draft: PriceSheetDraft): Promise<PriceSheet> {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = { ...(draft as object), id, status: 'draft' } as never as PriceSheet;
      const res = await writeThrough(
        'price_sheet.create',
        { id, version: draft.version, status: 'draft' },
        occurredAt,
        optimistic,
      );
      return res.data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * PayPeriodRepository
 * ------------------------------------------------------------------ */

export function createPayPeriodRepository(): PayPeriodRepository {
  return {
    async listForOrganization(organizationId: string): Promise<PayPeriod[]> {
      return readCached('af.payPeriods.listForOrganization', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('pay_periods')
          .select('*')
          .eq('organization_id', organizationId);
        if (error) {
          throw new Error(`listForOrganization failed: ${error.message}`);
        }
        return (data ?? []) as PayPeriod[];
      });
    },

    async getById(payPeriodId: string): Promise<PayPeriod | null> {
      return readCached('af.payPeriods.getById', { payPeriodId }, async () => {
        const { data, error } = await supabase
          .from('pay_periods')
          .select('*')
          .eq('id', payPeriodId)
          .maybeSingle();
        if (error) {
          throw new Error(`getById failed: ${error.message}`);
        }
        return (data as PayPeriod | null) ?? null;
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * LeadRepository
 * ------------------------------------------------------------------ */

export function createLeadRepository(): LeadRepository {
  return {
    async listForOrganization(organizationId: string): Promise<Lead[]> {
      return readCached('af.leads.listForOrganization', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('organization_id', organizationId);
        if (error) {
          throw new Error(`listForOrganization failed: ${error.message}`);
        }
        return (data ?? []).map((row) => toLead(row as LeadRow));
      });
    },

    async markQualified(leadId: string, jobId: string, qualifiedAt: string): Promise<Lead> {
      const optimistic = {
        ...(knownLeads.get(leadId) ?? { id: leadId }),
        qualifiedAt,
        convertedJobId: jobId,
      } as never as Lead;
      const res = await writeThrough('lead.mark_qualified', { leadId, jobId, qualifiedAt }, qualifiedAt, optimistic);
      return rememberLead(res.data);
    },

    async create(draft: NewLeadDraft): Promise<Lead> {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = { ...(draft as object), id, createdAt: occurredAt } as never as Lead;
      const res = await writeThrough('lead.create', { id, draft }, occurredAt, optimistic);
      return rememberLead(res.data);
    },

    async update(leadId: string, patch: LeadPatch): Promise<Lead> {
      const occurredAt = new Date().toISOString();
      const optimistic = { ...(knownLeads.get(leadId) ?? { id: leadId }), ...(patch as object) } as never as Lead;
      const res = await writeThrough('lead.update', { leadId, patch }, occurredAt, optimistic);
      return rememberLead(res.data);
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
      return readCached('af.employees.listEmployees', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('organization_id', organizationId)
          .order('full_name');
        if (error) {
          throw new Error(`listEmployees failed: ${error.message}`);
        }
        return ((data ?? []) as Array<Parameters<typeof toProfile>[0]>).map(toProfile);
      });
    },

    async getEmployee(profileId: string): Promise<Profile | null> {
      return readCached('af.employees.getEmployee', { profileId }, async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .maybeSingle();
        if (error) {
          throw new Error(`getEmployee failed: ${error.message}`);
        }
        return data ? toProfile(data as Parameters<typeof toProfile>[0]) : null;
      });
    },

    async changeEmployeeEmail(id: string, email: string): Promise<void> {
      requireOnline('update an employee email');
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
      await writeThrough('employee.update', { profileId, updates }, occurredAt, { id: profileId, ...updates } as never);
    },

    async deactivateEmployee(profileId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await writeThrough('employee.deactivate', { profileId }, occurredAt, { id: profileId, active: false } as never);
    },

    async reactivateEmployee(profileId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await writeThrough('employee.reactivate', { profileId }, occurredAt, { id: profileId, active: true } as never);
    },

    async setEmployeeRole(profileId: string, role: Role): Promise<void> {
      // Deliberately NOT routed through the offline queue —
      // this RPC needs the live authenticated admin session synchronously
      // for its own internal admin check and cannot be deferred/replayed.
      requireOnline('change an employee role');
      const { error } = await supabase.rpc('admin_set_employee_role', {
        p_profile_id: profileId,
        p_new_role: role,
      });
      if (error) {
        throw new Error(`setEmployeeRole failed: ${error.message}`);
      }
    },
    async getPrivate(profileId) {
      // Live read only: profile_private (SSN/emergency data) is never written to the plaintext read cache.
      const { data, error } = await supabase.from('profile_private').select('ssn_last4, emergency_contact_name, emergency_contact_phone').eq('profile_id', profileId).maybeSingle();
      if (error) throw new Error(`getPrivate failed: ${error.message}`);
      if (!data) return null;
      return { ssnLast4: data.ssn_last4 ?? null, emergencyContactName: data.emergency_contact_name ?? null, emergencyContactPhone: data.emergency_contact_phone ?? null };
    },
    async upsertPrivate(profileId, organizationId, patch) {
      requireOnline('save private employee details');
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
      const id = newClientId();
      const resolvedName = fullName?.trim() || email;
      // Duplicate-pending pre-check runs live when online (non-PK unique = real conflict = permanent).
      try {
        requireOnline('check for a duplicate invitation');
        const { data: dup, error: dupError } = await supabase
          .from('invitations')
          .select('id')
          .eq('organization_id', organizationId)
          .ilike('email', email)
          .is('consumed_at', null)
          .maybeSingle();
        if (dupError) {
          if (isDuplicatePendingInvitation(dupError)) throw new DuplicateInvitationError(email);
        } else if (dup) {
          throw new DuplicateInvitationError(email);
        }
      } catch (e) {
        if (e instanceof DuplicateInvitationError) throw e;
        // offline: skip the pre-check; the server rejects a real duplicate permanently on replay.
      }
      const optimistic: Invitation = { id, organizationId, email, role, createdAt: occurredAt };
      await writeThrough(
        'invitation.create',
        { id, organizationId, email, role, fullName: resolvedName },
        occurredAt,
        optimistic as never,
      );
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
      await writeThrough(
        'invitation.revoke',
        { invitationId },
        new Date().toISOString(),
        { invitationId } as never,
      );
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobAssignmentRepository
 * ------------------------------------------------------------------ */

export function createJobAssignmentRepository(): JobAssignmentRepository {
  return {
    async create(organizationId: string, draft: JobAssignmentDraft): Promise<void> {
      await writeThrough(
        'job_assignment.create',
        { id: newClientId(), organizationId, draft },
        new Date().toISOString(),
        { organizationId, ...draft } as never,
      );
    },

    async getInvestigatorTechId(jobId: string): Promise<string | null> {
      return readCached('af.assignments.getInvestigatorTechId', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_assignments')
          .select('tech_id, assigned_at')
          .eq('job_id', jobId)
          .eq('kind', 'investigator')
          .order('assigned_at', { ascending: false })
          .limit(1);
        if (error) throw new Error(`get investigator tech failed: ${error.message}`);
        return (data?.[0]?.tech_id as string | undefined) ?? null;
      });
    },

    async removeInvestigator(jobId: string): Promise<void> {
      await writeThrough(
        'job_assignment.remove_investigator',
        { jobId },
        new Date().toISOString(),
        { jobId } as never,
      );
    },

    async listInvestigatorTechIds(jobIds: string[]): Promise<Record<string, string>> {
      if (jobIds.length === 0) {
        return {};
      }
      return readCached('af.assignments.listInvestigatorTechIds', { jobIds }, async () => {
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
      });
    },

    async removeForJob(jobId: string, kind: 'installer' | 'investigator'): Promise<void> {
      await writeThrough(
        'job_assignment.remove_for_job',
        { jobId, kind },
        new Date().toISOString(),
        { jobId, kind } as never,
      );
    },
  };
}

/* ------------------------------------------------------------------ *
 * CommissionRepository
 * ------------------------------------------------------------------ */

export function createCommissionRepository(): CommissionRepository {
  return {
    async create(organizationId: string, line: CommissionLine, closedByUserId: string): Promise<void> {
      requireOnline('record a commission');

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
      return readCached('af.commissions.listForOrganization', { organizationId }, async () => {
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
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * PriceSheetRepo (publish flow)
 * ------------------------------------------------------------------ */

export function createPriceSheetPublishRepository(): PriceSheetRepo {
  return {
    async listForOrganization(organizationId: string): Promise<PriceSheet[]> {
      return readCached('af.priceSheets.listForOrganization', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('price_sheets')
          .select('*')
          .eq('organization_id', organizationId);
        if (error) {
          throw new Error(`listForOrganization failed: ${error.message}`);
        }
        return ((data ?? []) as PriceSheetRow[]).map(toPriceSheet);
      });
    },

    async listRates(priceSheetId: string): Promise<import('../../../../modules/admin-finance/src/money/types').PriceSheetRate[]> {
      return readCached('af.priceSheets.listRates', { priceSheetId }, async () => {
        const { data, error } = await supabase
          .from('price_sheet_rates')
          .select('*')
          .eq('price_sheet_id', priceSheetId);
        if (error) {
          throw new Error(`listRates failed: ${error.message}`);
        }
        return ((data ?? []) as PriceSheetRateRow[]).map(toPriceSheetRate);
      });
    },

    async getPublished(organizationId: string): Promise<PriceSheet | null> {
      return readCached('af.priceSheets.getPublished', { organizationId }, async () => {
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
      });
    },

    async applyPublishPlan(
      organizationId: string,
      plan: import('../../../../modules/admin-finance/src/money/publish-plan').PublishPlan,
    ): Promise<void> {
      requireOnline('publish a price sheet');
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
      return readCached('af.areaAdjustments.list', { priceSheetId }, () =>
        listAreaAdjustments(supabase as unknown as Parameters<typeof listAreaAdjustments>[0], priceSheetId),
      );
    },
    async save(
      priceSheetId: string,
      serviceAreaId: string,
      adjustmentType: 'percent' | 'flat',
      adjustmentValue: number
    ) {
      const occurredAt = new Date().toISOString();
      return (await writeThrough(
        'price_sheet_area_adjustment.upsert',
        { priceSheetId, serviceAreaId, adjustmentType, adjustmentValue, updatedAt: occurredAt },
        occurredAt,
        { ok: true, value: { priceSheetId, serviceAreaId, adjustmentType, adjustmentValue } } as never,
      )).data as Awaited<ReturnType<typeof saveAreaAdjustment>>;
    },
    async remove(id: string): Promise<CalculationResult<void>> {
      const occurredAt = new Date().toISOString();
      return (await writeThrough(
        'price_sheet_area_adjustment.delete',
        { id },
        occurredAt,
        { ok: true, value: undefined } as CalculationResult<void>,
      )).data;
    },
  };
}

export function createPriceSheetRatesRepository() {
  return {
    async list(priceSheetId: string) {
      return readCached('af.rates.list', { priceSheetId }, async () => {
        const { data, error } = await supabase
          .from('price_sheet_rates')
          .select('*, service_tasks(name)')
          .eq('price_sheet_id', priceSheetId);
        if (error) {
          throw new Error(`listRates failed: ${error.message}`);
        }
        return ((data ?? []) as PriceSheetRateWithTaskRow[]).map(toPriceSheetRateWithTask);
      });
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
      const body = { priceSheetId, serviceId, taskId, attachTiming, amount, timeEstimateMinutes };
      const rowId = id ?? newClientId();
      return (await writeThrough(
        id ? 'price_sheet_rate.update' : 'price_sheet_rate.create',
        { id: rowId, ...body },
        occurredAt,
        {
          ok: true,
          value: { id: rowId, ...body, createdAt: occurredAt, updatedAt: occurredAt },
        } as never,
      )).data as Awaited<ReturnType<typeof saveRateRepo>>;
    },
    async remove(rateId: string) {
      const occurredAt = new Date().toISOString();
      return (await writeThrough(
        'price_sheet_rate.delete',
        { id: rateId },
        occurredAt,
        { ok: true, value: undefined } as never,
      )).data as Awaited<ReturnType<typeof deleteRateRepo>>;
    },
  };
}

export function createServiceTasksRepository() {
  return {
    async list(organizationId: string, serviceId?: string) {
      return readCached('af.serviceTasks.list', { organizationId, serviceId: serviceId ?? null }, () =>
        listServiceTasksRepo(
          supabase as unknown as Parameters<typeof listServiceTasksRepo>[0],
          organizationId,
          serviceId
        ),
      );
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
      const rowId = newClientId();
      return (await writeThrough(
        'service_task.create',
        { id: rowId, serviceId, name, extra },
        occurredAt,
        {
          ok: true,
          value: { id: rowId, organizationId, serviceId, name, ...(extra ?? {}) },
        } as never,
      )).data as Awaited<ReturnType<typeof saveServiceTaskRepo>>;
    },
    async remove(taskId: string): Promise<CalculationResult<void>> {
      const occurredAt = new Date().toISOString();
      return (await writeThrough(
        'service_task.delete',
        { id: taskId },
        occurredAt,
        { ok: true, value: undefined } as CalculationResult<void>,
      )).data;
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
      return (await writeThrough(
        'service_task.update',
        { id: taskId, patch },
        occurredAt,
        { ok: true, value: { id: taskId, ...patch } } as never,
      )).data as Awaited<ReturnType<typeof updateServiceTaskRepo>>;
    },
    async listServices(organizationId: string): Promise<Array<{ id: string; name: string }>> {
      return readCached('af.serviceTasks.listServices', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('services')
          .select('id, name')
          .eq('organization_id', organizationId)
          .order('name');
        if (error) {
          throw new Error(`listServices failed: ${error.message}`);
        }
        return (data ?? []) as Array<{ id: string; name: string }>;
      });
    },
  };
}

export function createPriceSheetStandardDurationRepository() {
  return {
    async get(organizationId: string) {
      return readCached('af.standardDurations.get', { organizationId }, () =>
        getStandardDuration(
          supabase as unknown as Parameters<typeof getStandardDuration>[0],
          organizationId
        ),
      );
    },
    async upsert(organizationId: string, standardMinutes: number) {
      const occurredAt = new Date().toISOString();
      return (await writeThrough(
        'price_sheet_standard_duration.upsert',
        { standardMinutes, updatedAt: occurredAt },
        occurredAt,
        { ok: true, value: { organizationId, standardMinutes } } as never,
      )).data as Awaited<ReturnType<typeof upsertStandardDuration>>;
    },
  };
}

/* ------------------------------------------------------------------ *
 * ReimbursementRepo
 * ------------------------------------------------------------------ */

export function createReimbursementsRepository(): ReimbursementRepo {
  return {
    async listForOrganization(organizationId: string) {
      return readCached('af.reimbursements.listForOrganization', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('reimbursements')
          .select('*')
          .eq('organization_id', organizationId);
        if (error) {
          throw new Error(`listForOrganization failed: ${error.message}`);
        }
        return ((data ?? []) as ReimbursementRow[]).map(toReimbursement);
      });
    },

    async getById(reimbursementId: string) {
      return readCached('af.reimbursements.getById', { reimbursementId }, async () => {
        const { data, error } = await supabase
          .from('reimbursements')
          .select('*')
          .eq('id', reimbursementId)
          .maybeSingle();
        if (error) {
          throw new Error(`getById failed: ${error.message}`);
        }
        return data ? toReimbursement(data as ReimbursementRow) : null;
      });
    },

    async approve(input: ApproveReimbursementInput) {
      requireOnline('approve a reimbursement');
      const result = await approveReimbursementViaRpc(supabase as unknown as Parameters<typeof approveReimbursementViaRpc>[0], input);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.approveReimbursement', result.reason, { input });
      }
      return result;
    },

    async reject(input: RejectReimbursementInput) {
      requireOnline('reject a reimbursement');
      const result = await rejectReimbursementViaRpc(supabase as unknown as Parameters<typeof rejectReimbursementViaRpc>[0], input);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.rejectReimbursement', result.reason, { input });
      }
      return result;
    },

    async markPaid(reimbursementId: string) {
      requireOnline('mark a reimbursement paid');
      const result = await markReimbursementPaidViaRpc(supabase as unknown as Parameters<typeof markReimbursementPaidViaRpc>[0], reimbursementId);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.markReimbursementPaid', result.reason, { reimbursementId });
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
      return readCached('af.payoutBatches.listForOrganization', { organizationId }, async () => {
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
      });
    },

    async getById(batchId: string) {
      return readCached('af.payoutBatches.getById', { batchId }, async () => {
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
      });
    },

    async persist(batch: PayoutBatch) {
      requireOnline('create a payout batch');
      const result = await persistPayoutBatchViaRpc(supabase as unknown as Parameters<typeof persistPayoutBatchViaRpc>[0], batch);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.persistPayoutBatch', result.reason, { batch });
      }
      return result;
    },

    async approve(batchId: string) {
      const occurredAt = new Date().toISOString();
      const res = await writeThrough('payout_batch.approve', { batchId }, occurredAt, { ok: true, value: null } as never);
      return res.data;
    },

    async markPaid(batchId: string) {
      const occurredAt = new Date().toISOString();
      const res = await writeThrough('payout_batch.mark_paid', { batchId }, occurredAt, { ok: true, value: null } as never);
      return res.data;
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
      const rows = await readCached('af.closeOutPhotos.listForJob', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_photos')
          .select('id, storage_path')
          .eq('job_id', jobId);
        if (error) {
          throw new Error(`listForJob failed: ${error.message}`);
        }
        return (data ?? []) as Array<{ id: string; storage_path: string }>;
      });
      // Signed-URL resolution happens after the cached read; the cache holds storage paths only.
      return Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          uri: (await resolvePhotoUri(row.storage_path)) ?? row.storage_path,
        })),
      );
    },

    async add(jobId: string, uri: string, meta?: { ext: string; contentType: string }): Promise<CloseOutPhoto> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      const photoId = newClientId();
      const ext = meta?.ext ?? 'jpg';
      const contentType = meta?.contentType ?? 'image/jpeg';
      const storagePath = storagePathFor(organizationId, jobId, photoId, ext);
      const localUri = await copyToLocal(uri, organizationId, jobId, photoId, ext);
      const payload = {
        id: photoId,
        jobId,
        techId: userId,
        kind: 'after',
        storagePath,
        localUri,
        ext,
        contentType,
        occurredAt,
        lat: null,
        lng: null,
      };
      await writeThrough('job_photo.create', payload, occurredAt, { id: photoId, uri: localUri } as never);
      return { id: photoId, uri: localUri };
    },

    async remove(photoId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await writeThrough('job_photo.remove', { id: photoId }, occurredAt, { id: photoId } as never);
    },
  };
}

export function createCompensationPolicyRepository(): {
  getForOrganization(organizationId: string): Promise<CompensationPolicy | null>;
} {
  return {
    async getForOrganization(organizationId: string): Promise<CompensationPolicy | null> {
      const { data, error } = await supabase
        .from('compensation_policies')
        .select('id, organization_id, commission_basis_percent, hourly_rate_cents')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        throw new Error(`getForOrganization failed: ${error.message}`);
      }
      const row = (data as Array<{
        id: string;
        organization_id: string;
        commission_basis_percent: number | null;
        hourly_rate_cents: number | null;
      }> | null)?.[0];
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        organizationId: row.organization_id,
        commissionBasisPercent: Number(row.commission_basis_percent ?? 0),
        hourlyRate: Number(row.hourly_rate_cents ?? 0) as CompensationPolicy['hourlyRate'],
      };
    },
  };
}

export function createCloseOutNotesRepository(): JobNoteRepository {
  return {
    async getForJob(jobId: string): Promise<string> {
      return readCached('af.closeOutNotes.getForJob', { jobId }, async () => {
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
      });
    },

    async upsert(jobId: string, notes: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await writeThrough(
        'job_note.upsert',
        { id: newClientId(), jobId, notes, occurredAt },
        occurredAt,
        { jobId, body: notes } as never,
      );
    },
  };
}

export function createCloseOutContactLogRepository(): JobContactLogRepository {
  return {
    async listForJob(jobId: string): Promise<JobContactLogEntry[]> {
      return readCached('af.contactLog.listForJob', { jobId }, async () => {
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
      });
    },

    async create(
      jobId: string,
      organizationId: string,
      contactType: 'phone' | 'text' | 'email' | 'other',
      note: string | null,
    ): Promise<JobContactLogEntry> {
      const { userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      const clientId = newClientId();
      // The handler writes clientId into client_id; the table's identity PK differs, so the
      // returned optimistic row's id is a placeholder, not the server id.
      const optimistic = {
        // job_contact_log.id is a bigint identity; 0 is a display placeholder until replay — client_id is the replay key.
        id: 0,
        organizationId,
        jobId,
        contactType,
        note,
        contactedBy: userId,
        createdAt: occurredAt,
      };
      await writeThrough(
        'job_contact_log.create',
        { id: clientId, jobId, organizationId, contactType, note },
        occurredAt,
        optimistic as never,
      );
      return optimistic;
    },
  };
}

export function createCloseOutFailuresRepository(): CloseOutFailureRepository {
  const OPEN_STATUSES = ['open', 'retrying'] as const;

  async function fetchOpenFailureRow(jobId: string) {
    // Offline-first: when offline (or the read throws) assume no open row so the
    // write still queues. Replay handlers for .update/.record_attempt/.resolve_retry
    // match by job_id + open status, and .create on a job that already has an open
    // row hits the partial unique index close_out_failures_one_open_per_job_idx, a
    // permanent-class replay error that surfaces in the sync indicator, not data loss.
    if (!isOnlineNow()) return null;
    try {
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
    } catch {
      return null;
    }
  }

  return {
    async recordFailure(
      organizationId: string,
      jobId: string,
      stage: CloseOutFailureStage,
      reason: string,
    ): Promise<void> {
      const occurredAt = new Date().toISOString();

      const existing = await fetchOpenFailureRow(jobId);

      if (existing) {
        await writeThrough(
          'close_out_failure.update',
          { jobId, stage, reason, occurredAt },
          occurredAt,
          { ...existing, stage, reason, updated_at: occurredAt } as never,
        );
        return;
      }

      const id = newClientId();
      await writeThrough(
        'close_out_failure.create',
        { id, jobId, stage, reason },
        occurredAt,
        { id, organization_id: organizationId, job_id: jobId, stage, reason, status: 'open', attempts: 0, last_attempted_at: null, resolved_by: null, resolved_at: null, resolution_note: null, created_at: occurredAt, updated_at: occurredAt } as never,
      );
    },

    async recordAttempt(jobId: string): Promise<void> {
      const occurredAt = new Date().toISOString();

      const existing = await fetchOpenFailureRow(jobId);
      if (!existing) {
        throw new Error(`recordAttempt: no open close-out failure found for job ${jobId}`);
      }

      await writeThrough(
        'close_out_failure.record_attempt',
        { jobId, occurredAt },
        occurredAt,
        { ...existing, attempts: existing.attempts + 1, last_attempted_at: occurredAt, status: 'retrying', updated_at: occurredAt } as never,
      );
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

      const existing = await fetchOpenFailureRow(jobId);
      if (!existing) {
        throw new Error(`resolve: no open close-out failure found for job ${jobId}`);
      }

      if (resolution === 'resolved_manual') {
        requireOnline('resolve a close-out failure manually');
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

      await writeThrough(
        'close_out_failure.resolve_retry',
        { jobId, resolvedBy, note: note ?? null, occurredAt },
        occurredAt,
        { ...existing, status: 'resolved_retry', resolved_by: resolvedBy, resolved_at: occurredAt, resolution_note: note ?? null, updated_at: occurredAt } as never,
      );
    },

    async listNeedingAttention(organizationId: string): Promise<CloseOutFailureRecord[]> {
      return readCached('af.closeOutFailures.listNeedingAttention', { organizationId }, async () => {
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
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * AuditLogRepository
 * ------------------------------------------------------------------ */

/**
 * Read-only merged job timeline (#0018 Trail). Each source is read best-effort:
 * a failed read contributes nothing and never fails the whole timeline.
 * job_time_segments has no voided_at column, so voidedAt is always null.
 */
export function createJobTimelineRepository(): JobTimelineRepository {
  async function rows<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
    try {
      const { data, error } = await q;
      return error ? [] : ((data ?? []) as T[]);
    } catch {
      return [];
    }
  }
  return {
    async listForJob(jobId: string): Promise<JobTimelineItem[]> {
      return readCached('af.jobTimeline.listForJob', { jobId }, async () => {
        const [job, audit, contacts, notes, segments, payments, calendar, failures] = await Promise.all([
          rows<{ created_at: string }>(supabase.from('jobs').select('created_at').eq('id', jobId)),
          rows<{ action: string; actor_id: string | null; created_at: string }>(
            supabase.from('audit_log').select('action, actor_id, created_at').eq('entity', 'job').eq('entity_id', jobId),
          ),
          rows<{ contact_type: string; note: string | null; contacted_by: string | null; created_at: string }>(
            supabase.from('job_contact_log').select('contact_type, note, contacted_by, created_at').eq('job_id', jobId),
          ),
          rows<{ kind: string; body: string; tech_id: string | null; occurred_at: string }>(
            supabase.from('job_notes').select('kind, body, tech_id, occurred_at').eq('job_id', jobId),
          ),
          rows<{ reason_code: string; started_at: string; ended_at: string | null; tech_id: string }>(
            supabase.from('job_time_segments').select('reason_code, started_at, ended_at, tech_id').eq('job_id', jobId),
          ),
          rows<{ amount: number | string; status: string; method: string | null; created_at: string }>(
            supabase.from('payments').select('amount, status, method, created_at').eq('job_id', jobId),
          ),
          rows<{ kind: string; title: string | null; event_time: string; created_by: string | null }>(
            supabase.from('calendar_events').select('kind, title, event_time, created_by').eq('job_id', jobId),
          ),
          rows<{ stage: string; reason: string; status: string; created_at: string }>(
            supabase.from('close_out_failures').select('stage, reason, status, created_at').eq('job_id', jobId),
          ),
        ]);
        const sources: JobTimelineSources = {
          jobCreatedAt: job[0]?.created_at ?? null,
          audit: audit.map((r) => ({ action: r.action, actorId: r.actor_id, createdAt: r.created_at })),
          contacts: contacts.map((r) => ({
            contactType: r.contact_type,
            note: r.note,
            contactedBy: r.contacted_by,
            createdAt: r.created_at,
          })),
          notes: notes.map((r) => ({ kind: r.kind, body: r.body, techId: r.tech_id, occurredAt: r.occurred_at })),
          segments: segments.map((r) => ({
            reasonCode: r.reason_code,
            startedAt: r.started_at,
            endedAt: r.ended_at,
            techId: r.tech_id,
            voidedAt: null,
          })),
          payments: payments.map((r) => ({
            amount: Number(r.amount),
            status: r.status,
            method: r.method,
            createdAt: r.created_at,
          })),
          calendar: calendar.map((r) => ({
            kind: r.kind,
            title: r.title,
            eventTime: r.event_time,
            createdBy: r.created_by,
          })),
          failures: failures.map((r) => ({
            stage: r.stage,
            reason: r.reason,
            status: r.status,
            createdAt: r.created_at,
          })),
        };
        return buildJobTimeline(sources);
      });
    },
  };
}

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
      return readCached('af.techServiceAreas.listForOrganization', { organizationId }, async () => {
        const result = await listTechServiceAreas(supabase, organizationId);
        if (!result.ok) {
          throw new Error(`listForOrganization failed: ${result.reason}`);
        }
        return result.value;
      });
    },

    async assignToTech(organizationId: string, techId: string, serviceAreaId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await writeThrough('tech_service_area.assign', { organizationId, techId, serviceAreaId }, occurredAt, undefined as never);
    },

    async removeFromTech(organizationId: string, techId: string, serviceAreaId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await writeThrough('tech_service_area.remove', { organizationId, techId, serviceAreaId }, occurredAt, undefined as never);
    },
  };
}

function createTechSkillRepository(): TechSkillRepository {
  return {
    async listForOrganization(organizationId: string) {
      return readCached('af.techSkills.listForOrganization', { organizationId }, async () => {
        const result = await listTechSkills(supabase, organizationId);
        if (!result.ok) {
          throw new Error(result.reason);
        }
        return result.value;
      });
    },
    async assignToTech(organizationId: string, techId: string, skill: string) {
      const occurredAt = new Date().toISOString();
      await writeThrough('tech_skill.assign', { organizationId, techId, skill }, occurredAt, undefined as never);
    },
    async removeFromTech(organizationId: string, techId: string, skill: string) {
      const occurredAt = new Date().toISOString();
      await writeThrough('tech_skill.remove', { organizationId, techId, skill }, occurredAt, undefined as never);
    },
  };
}

/* ------------------------------------------------------------------ *
 * ServiceAreaRepository
 * ------------------------------------------------------------------ */

export function createServiceAreaRepository(): ServiceAreaRepository {
  return {
    async listForOrganization(organizationId: string) {
      return readCached('af.serviceAreas.listForOrganization', { organizationId }, async () => {
        const result = await listServiceAreas(supabase, organizationId);
        if (!result.ok) {
          throw new Error(`listForOrganization failed: ${result.reason}`);
        }
        return result.value;
      });
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
      return readCached('af.payments.listNeedingAttention', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('organization_id', organizationId)
          .in('status', ['pending', 'failed']);
        if (error) {
          throw new Error(`listNeedingAttention failed: ${error.message}`);
        }
        return ((data ?? []) as PaymentRow[]).map(toPayment);
      });
    },
    async listManuallyConfirmed(organizationId: string): Promise<Payment[]> {
      return readCached('af.payments.listManuallyConfirmed', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'manual_confirmed');
        if (error) {
          throw new Error(`listManuallyConfirmed failed: ${error.message}`);
        }
        return ((data ?? []) as PaymentRow[]).map(toPayment);
      });
    },
    async listForJob(jobId: string): Promise<Payment[]> {
      return readCached('af.payments.listForJob', { jobId }, async () => {
        const { data, error } = await supabase.from('payments').select('*').eq('job_id', jobId);
        if (error) {
          throw new Error(`list job payments failed: ${error.message}`);
        }
        return ((data ?? []) as PaymentRow[]).map(toPayment);
      });
    },
    async recordManualPayment(organizationId: string, jobId: string, amount: number): Promise<Payment> {
      const id = newClientId();
      const confirmedAt = new Date().toISOString();
      const optimistic = toPayment({
        id,
        organization_id: organizationId,
        job_id: jobId,
        provider_id: 'manual',
        amount,
        status: 'manual_confirmed',
        external_ref: null,
        confirmed_at: confirmedAt,
        confirmed_by: requireModuleSession().userId,
        created_at: confirmedAt,
      } as unknown as PaymentRow);
      const res = await writeThrough('payment.record_manual', { id, jobId, amount, confirmedAt }, confirmedAt, optimistic as never);
      return res.data as Payment;
    },
    async recordPayment(organizationId: string, jobId: string, input: { amount: number; method: PaymentMethod }): Promise<Payment> {
      const id = newClientId();
      const confirmedAt = new Date().toISOString();
      const { amount, method } = input;
      const optimistic = toPayment({
        id,
        organization_id: organizationId,
        job_id: jobId,
        provider_id: 'manual',
        amount,
        method,
        status: 'manual_confirmed',
        external_ref: null,
        confirmed_at: confirmedAt,
        confirmed_by: requireModuleSession().userId,
        created_at: confirmedAt,
      } as unknown as PaymentRow);
      const res = await writeThrough('payment.record_manual', { id, jobId, amount, method, confirmedAt }, confirmedAt, optimistic as never);
      return res.data as Payment;
    },
  };
}

/* ------------------------------------------------------------------ *
 * CalendarEventRepository
 * ------------------------------------------------------------------ */

export function createCalendarEventRepository(): CalendarEventRepository {
  return {
    async create(organizationId: string, draft: CalendarEventDraft): Promise<void> {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = {
        id,
        organization_id: organizationId,
        job_id: draft.jobId,
        kind: draft.kind,
        title: draft.title ?? null,
        description: draft.description ?? null,
        event_time: draft.eventTime,
        created_by: requireModuleSession().userId,
      };
      await writeThrough('calendar_event.create', { id, organizationId, draft }, occurredAt, optimistic as never);
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
      return readCached('af.timeOff.listForOrganization', { organizationId }, async () => {
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
      });
    },

    async createBlackout(
      organizationId: string,
      techId: string,
      draft: { startDate: string; endDate: string; reason: string | null },
    ) {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimisticRow: TimeOffRequestAdminRow = {
        id,
        organization_id: organizationId,
        tech_id: techId,
        start_date: draft.startDate,
        end_date: draft.endDate,
        reason: draft.reason,
        status: 'approved',
        created_at: occurredAt,
        updated_at: occurredAt,
        created_by_admin_id: requireModuleSession().userId,
      } as never;
      const optimistic = toTimeOffRequestAdmin(optimisticRow);
      await writeThrough('time_off_request.create_blackout', { id, organizationId, techId, draft }, occurredAt, optimistic as never);
      return optimistic;
    },

    async cancel(requestId: string): Promise<void> {
      await writeThrough('time_off_request.admin_cancel', { requestId }, new Date().toISOString(), undefined);
    },
  };
}

/* ------------------------------------------------------------------ *
 * CustomerRepository
 * ------------------------------------------------------------------ */

export function createCustomerRepository(): CustomerRepository {
  return {
    async getById(id: string): Promise<Customer | null> {
      return readCached('af.customers.getById', { id }, async () => {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) {
          throw new Error(`getById failed: ${error.message}`);
        }
        return data ? toCustomer(data as CustomerRow) : null;
      });
    },

    async listContacts(customerId: string): Promise<CustomerContact[]> {
      return readCached('af.customers.listContacts', { customerId }, async () => {
        const { data, error } = await supabase
          .from('customer_contacts')
          .select('id, customer_id, kind, label, value, created_at')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: true });
        if (error) {
          throw new Error(`listContacts failed: ${error.message}`);
        }
        return ((data ?? []) as Array<{
          id: string;
          customer_id: string;
          kind: CustomerContact['kind'];
          label: string | null;
          value: string;
          created_at: string;
        }>).map((r) => ({
          id: r.id,
          customerId: r.customer_id,
          kind: r.kind,
          label: r.label,
          value: r.value,
          createdAt: r.created_at,
        }));
      });
    },

    async listJobHistory(customerId: string): Promise<CustomerJobHistoryItem[]> {
      return readCached('af.customers.listJobHistory', { customerId }, async () => {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });
        if (error) {
          throw new Error(`listJobHistory failed: ${error.message}`);
        }
        return ((data ?? []) as JobRow[]).map(toJob).map((j) => ({
          jobId: j.id,
          jobNumber: j.jobNumber,
          title: j.description,
          status: j.status,
          createdAt: j.createdAt,
        }));
      });
    },

    async create(input: CustomerCreateInput): Promise<Customer> {
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = {
        id,
        organizationId: input.organizationId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
      } as never as Customer;
      const result = await writeThrough('customer.create', { id, input }, occurredAt, optimistic as never);
      return result.data as Customer;
    },

    async update(id: string, patch: CustomerPatch): Promise<Customer> {
      const occurredAt = new Date().toISOString();
      const optimistic = { id, ...patch } as never as Customer;
      const result = await writeThrough('customer.update', { id, patch }, occurredAt, optimistic as never);
      return result.data as Customer;
    },

    async saveForJob(jobId: string, patch: CustomerPatch): Promise<Customer> {
      const occurredAt = new Date().toISOString();
      const optimistic = { ...patch } as never as Customer;
      const result = await writeThrough('job_customer.save', { jobId, patch }, occurredAt, optimistic as never);
      return result.data as Customer;
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
      return readCached('af.jobPlanning.getForJob', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_planning_details')
          .select('*')
          .eq('job_id', jobId)
          .maybeSingle();
        if (error) {
          throw new Error(`getForJob failed: ${error.message}`);
        }
        return data ? toJobPlanningDetails(data as Parameters<typeof toJobPlanningDetails>[0]) : null;
      });
    },

    async upsertForJob(jobId: string, details: JobPlanningDetailsInput): Promise<JobPlanningDetails> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      const optimistic: JobPlanningDetails = {
        jobId,
        organizationId,
        modelNumbers: details.modelNumbers ?? null,
        partsList: details.partsList ?? null,
        measurements: details.measurements ?? null,
        instructions: details.instructions ?? null,
        ingressNotes: details.ingressNotes ?? null,
        logisticsNotes: details.logisticsNotes ?? null,
        parkingNotes: details.parkingNotes ?? null,
        stateAssessment: details.stateAssessment ?? null,
        updatedAt: occurredAt,
        updatedBy: userId,
      };
      const { data } = await writeThrough(
        'job_planning.upsert',
        { jobId, details, updatedAt: occurredAt },
        occurredAt,
        optimistic,
      );
      return data;
    },
  };
}

export function createJobPlanningPhotoRepository(): JobPlanningPhotoRepository {
  return {
    async listForJob(jobId: string): Promise<JobPlanningPhoto[]> {
      const rows = await readCached('af.jobPlanningPhotos.listForJob', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_planning_photos')
          .select('*')
          .eq('job_id', jobId);
        if (error) {
          throw new Error(`listForJob failed: ${error.message}`);
        }
        return (data ?? []) as Array<{
          id: string;
          job_id: string;
          organization_id: string;
          storage_path: string;
          caption: string | null;
          created_at: string;
          created_by: string | null;
        }>;
      });
      // Signed-URL resolution happens after the cached read; the cache holds storage paths only.
      return Promise.all(
        rows.map(
          async (row) =>
            ({
              id: row.id,
              jobId: row.job_id,
              organizationId: row.organization_id,
              storagePath: row.storage_path,
              caption: row.caption,
              createdAt: row.created_at,
              createdBy: row.created_by,
              uri: (await resolvePhotoUri(row.storage_path)) ?? row.storage_path,
            }) as JobPlanningPhoto,
        ),
      );
    },

    async addForJob(jobId: string, photo: JobPlanningPhotoInput): Promise<JobPlanningPhoto> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const ext = 'jpg';
      const storagePath = planningStoragePathFor(organizationId, jobId, id, ext);
      // The port input carries only a placeholder/source path; it is the local source for the queued upload.
      // Caption is NOT sent (known W6 caveat).
      const optimistic: JobPlanningPhoto = {
        id,
        jobId,
        organizationId,
        storagePath,
        caption: photo.caption ?? null,
        createdAt: occurredAt,
        createdBy: userId,
      };
      const { data } = await writeThrough(
        'job_planning_photo.add',
        { id, jobId, storagePath, localUri: photo.storagePath, ext },
        occurredAt,
        optimistic,
      );
      return data;
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
  materials_onsite?: boolean | null;
  tracking_number?: string | null;
  tracking_status?: string | null;
  tracking_checked_at?: string | null;
  fine_print?: string | null;
  pdf_delivery?: boolean | null;
  contingencies?: unknown;
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
    materialsOnsite: row.materials_onsite ?? false,
    trackingNumber: row.tracking_number ?? null,
    trackingStatus: row.tracking_status ?? null,
    trackingCheckedAt: row.tracking_checked_at ?? null,
    finePrint: row.fine_print ?? null,
    pdfDelivery: row.pdf_delivery ?? false,
    contingencies: Array.isArray(row.contingencies)
      ? (row.contingencies as Array<Record<string, unknown> | null>).map((c) => ({
          description: String(c?.description ?? ''),
          price: c?.price === null || c?.price === undefined ? null : Number(c.price),
        }))
      : [],
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
  job_plan_task_id?: string | null;
  service_task_id?: string | null;
  origin_line_item_id?: string | null;
  unit?: string | null;
  area?: string | null;
  materials_note?: string | null;
  task_snapshot_at?: string | null;
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
    jobPlanTaskId: row.job_plan_task_id ?? null,
    serviceTaskId: row.service_task_id ?? null,
    originLineItemId: row.origin_line_item_id ?? null,
    unit: row.unit ?? null,
    area: row.area ?? null,
    materialsNote: row.materials_note ?? null,
    taskSnapshotAt: row.task_snapshot_at ?? row.created_at,
  };
}

// Shared by addLineItem and saveLineAsNew. task_snapshot_at is never sent (db default).
async function addEstimateLineItem(
  jobId: string,
  draft: JobEstimateLineItemDraft,
  organizationId: string,
  userId: string | null,
): Promise<JobEstimateLineItem> {
  const occurredAt = new Date().toISOString();
  const id = newClientId();
  const result = await writeThrough(
    'job_estimate_line_item.add',
    { id, jobId, draft },
    occurredAt,
    {
      id,
      jobId,
      organizationId,
      kind: draft.kind,
      description: draft.description,
      quantity: draft.quantity,
      unitCost: draft.unitCost,
      lineTotal: draft.lineTotal,
      createdAt: occurredAt,
      createdBy: userId,
      jobPlanTaskId: draft.jobPlanTaskId ?? null,
      serviceTaskId: draft.serviceTaskId ?? null,
      originLineItemId: draft.originLineItemId ?? null,
      unit: draft.unit ?? null,
      area: draft.area ?? null,
      materialsNote: draft.materialsNote ?? null,
      taskSnapshotAt: occurredAt,
    } as never,
  );
  return result.data as JobEstimateLineItem;
}

export function createEstimateRepository(): EstimateRepository {
  return {
    async getForJob(jobId: string): Promise<JobEstimate | null> {
      const { organizationId } = requireModuleSession();
      return readCached('af.estimates.getForJob', { jobId }, async () => {
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
      if (input.finePrint !== undefined) {
        patch.fine_print = input.finePrint;
      }
      if (input.pdfDelivery !== undefined) {
        patch.pdf_delivery = input.pdfDelivery;
      }
      if (input.contingencies !== undefined) {
        patch.contingencies = input.contingencies;
      }

      const optimistic = {
        job_id: jobId,
        organization_id: organizationId,
        status: 'draft',
        summary: null,
        materials_notes: null,
        labor_notes: null,
        materials_cost: 0,
        labor_cost: 0,
        other_cost: 0,
        total_cost: 0,
        scheduled_start: null,
        scheduled_end: null,
        payment_terms: null,
        deposit_amount: null,
        customer_notes: null,
        internal_notes: null,
        created_at: occurredAt,
        updated_at: occurredAt,
        created_by: userId,
        updated_by: userId,
        ...patch,
      };
      const result = await writeThrough(
        'job_estimate.upsert',
        { jobId, input },
        occurredAt,
        toJobEstimate(optimistic as never) as never,
      );
      return result.data as JobEstimate;
    },

    async listLineItems(jobId: string): Promise<JobEstimateLineItem[]> {
      const { organizationId } = requireModuleSession();
      return readCached('af.estimates.listLineItems', { jobId }, async () => {
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
      return addEstimateLineItem(jobId, draft, organizationId, userId);
    },

    // Clone with a fresh id; origin_line_item_id points back at the source line.
    async saveLineAsNew(sourceLineId: string, draft: JobEstimateLineItemDraft): Promise<JobEstimateLineItem> {
      const { organizationId, userId } = requireModuleSession();
      // The draft carries no jobId; the clone lands on the source line's job.
      const { data: source, error } = await supabase
        .from('job_estimate_line_items')
        .select('job_id')
        .eq('id', sourceLineId)
        .single();
      if (error || !source) {
        throw new Error(`saveLineAsNew failed: ${error?.message ?? 'source line not found'}`);
      }
      return addEstimateLineItem(
        (source as { job_id: string }).job_id,
        { ...draft, originLineItemId: sourceLineId },
        organizationId,
        userId,
      );
    },

    async saveLineToPriceSheet(lineId: string): Promise<{ serviceTaskId: string }> {
      requireOnline('save an estimate line to the price sheet');
      const { data, error } = await supabase.rpc('save_estimate_line_to_price_sheet', { p_line_id: lineId });
      if (error) {
        throw new Error(`saveLineToPriceSheet failed: ${error.message}`);
      }
      return { serviceTaskId: data as string };
    },

    async updateLineItem(lineItemId: string, patch: Partial<JobEstimateLineItemDraft>): Promise<JobEstimateLineItem> {
      requireOnline('edit an estimate line item');

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
      if (patch.serviceTaskId !== undefined) {
        updatePatch.service_task_id = patch.serviceTaskId;
      }
      if (patch.unit !== undefined) {
        updatePatch.unit = patch.unit;
      }
      if (patch.area !== undefined) {
        updatePatch.area = patch.area;
      }
      if (patch.materialsNote !== undefined) {
        updatePatch.materials_note = patch.materialsNote;
      }
      // An overwrite save re-snapshots the task content.
      updatePatch.task_snapshot_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('job_estimate_line_items')
        .update(updatePatch)
        .eq('id', lineItemId)
        .select('*')
        .single();
      if (error) {
        throw new Error(`updateLineItem failed: ${error.message}`);
      }
      return toJobEstimateLineItem(data as Parameters<typeof toJobEstimateLineItem>[0]);
    },

    async removeLineItem(lineItemId: string): Promise<void> {
      requireOnline('remove an estimate line item');

      const { error } = await supabase.from('job_estimate_line_items').delete().eq('id', lineItemId);
      if (error) {
        throw new Error(`removeLineItem failed: ${error.message}`);
      }
    },

    async issueShareLink(jobId: string): Promise<{ token: string; url: string }> {
      requireOnline('issue an estimate link');
      const { data, error } = await supabase.rpc('issue_estimate_token', { p_job_id: jobId });
      if (error) {
        throw new Error(`issueShareLink failed: ${error.message}`);
      }
      const token = data as string;
      return { token, url: `${supabaseUrl}/functions/v1/estimate-resolve?token=${token}` };
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

    async getFinePrintTemplate(): Promise<string | null> {
      const { organizationId } = requireModuleSession();
      const { data, error } = await supabase
        .from('estimate_settings')
        .select('fine_print_template')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) {
        throw new Error(`getFinePrintTemplate failed: ${error.message}`);
      }
      const t = (data as { fine_print_template?: string | null } | null)?.fine_print_template;
      return typeof t === 'string' ? t : null;
    },

    async setFinePrintTemplate(text: string): Promise<void> {
      requireOnline('save the estimate fine print');
      const { organizationId } = requireModuleSession();
      const { error } = await supabase
        .from('estimate_settings')
        .upsert(
          { organization_id: organizationId, fine_print_template: text, updated_at: new Date().toISOString() },
          { onConflict: 'organization_id' },
        );
      if (error) {
        throw new Error(`setFinePrintTemplate failed: ${error.message}`);
      }
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
      return readCached('af.investigations.getForJob', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_investigations')
          .select('*')
          .eq('job_id', jobId)
          .maybeSingle();
        if (error) {
          throw new Error(`getForJob failed: ${error.message}`);
        }
        return data ? toJobInvestigation(data as Parameters<typeof toJobInvestigation>[0]) : null;
      });
    },

    async upsertForJob(jobId: string, patch: JobInvestigationInput): Promise<JobInvestigation> {
      const { organizationId, userId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      const { techId: _techId, ...patchFields } = patch;
      const optimistic = {
        id: jobId,
        jobId,
        organizationId,
        techId: userId,
        ingressNotes: patch.ingressNotes ?? null,
        logisticsNotes: patch.logisticsNotes ?? null,
        parkingNotes: patch.parkingNotes ?? null,
        stateAssessment: patch.stateAssessment ?? null,
        roomWork: patch.roomWork ?? [],
        measurements: patch.measurements ?? null,
        techInstructions: patch.techInstructions ?? null,
        materialsArrived: patch.materialsArrived ?? null,
        submittedAt: patch.submittedAt ?? null,
        updatedAt: occurredAt,
      } as never as JobInvestigation;
      const { data } = await writeThrough(
        'job_investigation.upsert',
        { jobId, occurredAt, patch: patchFields },
        occurredAt,
        optimistic,
      );
      return data;
    },
  };
}

/* ------------------------------------------------------------------ *
 * JobPlanTasksRepository
 * ------------------------------------------------------------------ */

type JobPlanTaskDbRow = {
  id: string;
  job_id: string;
  service_task_id: string | null;
  kind?: 'price_sheet' | 'misc' | null;
  title?: string | null;
  billing?: 'flat' | 'hourly' | null;
  status?: 'planned' | 'done' | 'deferred' | null;
  source?: 'plan' | 'prem' | 'estimate' | 'description' | 'spawn' | null;
  estimated_minutes?: number | null;
  sort_order?: number | null;
  quantity: number;
  notes: string | null;
  unit?: string | null;
  area?: string | null;
  materials_note?: string | null;
  content_updated_at?: string | null;
  // Null for techs: service_tasks is not readable under their RLS.
  service_tasks?: {
    name: string;
    estimated_minutes: number | null;
    rate: number | null;
    category: string | null;
    active: boolean;
  } | null;
  jobs?: { job_number: string | number | null; status: string | null } | null;
};

const JOB_PLAN_TASK_SELECT =
  '*, service_tasks(name, estimated_minutes, rate, category, active)';

function toJobPlanTaskRow(row: JobPlanTaskDbRow): JobPlanTaskRow {
  const task = row.service_tasks ?? null;
  const title = row.title ?? task?.name ?? '';
  return {
    id: row.id,
    jobId: row.job_id,
    serviceTaskId: row.service_task_id ?? null,
    kind: row.kind ?? (row.service_task_id ? 'price_sheet' : 'misc'),
    title,
    billing: row.billing ?? 'flat',
    status: row.status ?? 'planned',
    source: row.source ?? 'plan',
    sortOrder: row.sort_order ?? 0,
    quantity: row.quantity,
    notes: row.notes,
    name: title,
    estimatedMinutes: row.estimated_minutes ?? task?.estimated_minutes ?? null,
    rate: task?.rate ?? null,
    category: task?.category ?? null,
    active: task?.active ?? true,
    unit: row.unit ?? null,
    area: row.area ?? null,
    materialsNote: row.materials_note ?? null,
    contentUpdatedAt: row.content_updated_at ?? '',
  };
}

export function createJobPlanTasksRepository(): JobPlanTasksRepository {
  return {
    async listTitlesForJobs(jobIds: string[]): Promise<Record<string, string[]>> {
      if (jobIds.length === 0) return {};
      return readCached('af.planTasks.listTitlesForJobs', { jobIds }, async () => {
        const { data, error } = await supabase
          .from('job_task_summary_v')
          .select('job_id, task_titles')
          .in('job_id', jobIds);
        if (error) throw new Error(`listTitlesForJobs failed: ${error.message}`);
        const out: Record<string, string[]> = {};
        for (const row of (data ?? []) as Array<{ job_id: string; task_titles: string[] | null }>) {
          out[row.job_id] = row.task_titles ?? [];
        }
        return out;
      });
    },

    async listCatalogTasks(organizationId: string): Promise<ServiceTaskCatalogEntry[]> {
      return readCached('af.planTasks.listCatalogTasks', { organizationId }, async () => {
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
      });
    },

    async listServices(organizationId: string): Promise<Array<{ id: string; name: string }>> {
      return readCached('af.planTasks.listServices', { organizationId }, async () => {
        const { data, error } = await supabase
          .from('services')
          .select('id, name')
          .eq('organization_id', organizationId)
          .order('name');
        if (error) {
          throw new Error(`listServices failed: ${error.message}`);
        }
        return (data ?? []) as Array<{ id: string; name: string }>;
      });
    },

    async listForJob(jobId: string): Promise<JobPlanTaskRow[]> {
      return readCached('af.planTasks.listForJob', { jobId }, async () => {
        const { data, error } = await supabase
          .from('job_plan_tasks')
          .select(JOB_PLAN_TASK_SELECT)
          .eq('job_id', jobId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) {
          throw new Error(`listForJob failed: ${error.message}`);
        }
        return ((data ?? []) as unknown as JobPlanTaskDbRow[]).map(toJobPlanTaskRow);
      });
    },

    async addTask(jobId: string, serviceTaskId: string, quantity: number): Promise<JobPlanTaskRow> {
      const { organizationId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const optimistic = {
        id,
        jobId,
        serviceTaskId,
        kind: 'price_sheet',
        title: '',
        billing: 'flat',
        status: 'planned',
        source: 'plan',
        sortOrder: 0,
        quantity,
        notes: null,
        name: '',
        estimatedMinutes: null,
        rate: null,
        category: null,
        active: true,
      } as never as JobPlanTaskRow;
      const { data } = await writeThrough(
        'job_plan_task.create',
        { id, organizationId, jobId, serviceTaskId, quantity },
        occurredAt,
        optimistic,
      );
      return data;
    },

    async addMiscTask(jobId, input) {
      const { organizationId } = requireModuleSession();
      const occurredAt = new Date().toISOString();
      const id = newClientId();
      const source = input.source ?? 'plan';
      const optimistic = {
        id,
        jobId,
        serviceTaskId: null,
        kind: 'misc',
        title: input.title,
        billing: 'hourly',
        status: 'planned',
        source,
        sortOrder: 0,
        quantity: 1,
        notes: input.notes ?? null,
        name: input.title,
        estimatedMinutes: input.estimatedMinutes ?? null,
        rate: null,
        category: null,
        active: true,
        unit: input.unit ?? null,
        area: input.area ?? null,
        materialsNote: input.materialsNote ?? null,
      } as never as JobPlanTaskRow;
      const { data } = await writeThrough(
        'job_plan_task.create',
        {
          id,
          organizationId,
          jobId,
          serviceTaskId: null,
          kind: 'misc',
          title: input.title,
          notes: input.notes ?? null,
          estimatedMinutes: input.estimatedMinutes ?? null,
          source,
          unit: input.unit ?? null,
          area: input.area ?? null,
          materialsNote: input.materialsNote ?? null,
        },
        occurredAt,
        optimistic,
      );
      return data;
    },

    async updateTask(taskRowId, patch) {
      const occurredAt = new Date().toISOString();
      const optimistic = { id: taskRowId, ...patch } as never as JobPlanTaskRow;
      const { data } = await writeThrough(
        'job_plan_task.update',
        { taskRowId, patch, updatedAt: occurredAt },
        occurredAt,
        optimistic,
      );
      return data;
    },

    async deferTask(taskRowId) {
      const occurredAt = new Date().toISOString();
      const optimistic = { id: taskRowId, status: 'deferred' } as never as JobPlanTaskRow;
      const { data } = await writeThrough(
        'job_plan_task.defer',
        { taskRowId, updatedAt: occurredAt },
        occurredAt,
        optimistic,
      );
      return data;
    },

    async listForCustomer(customerId) {
      return readCached('af.planTasks.listForCustomer', { customerId }, async () => {
        const { data, error } = await supabase
          .from('job_plan_tasks')
          .select(`${JOB_PLAN_TASK_SELECT}, jobs!inner(job_number, status, customer_id)`)
          .eq('jobs.customer_id', customerId)
          .order('created_at', { ascending: true });
        if (error) {
          throw new Error(`listForCustomer failed: ${error.message}`);
        }
        return ((data ?? []) as unknown as JobPlanTaskDbRow[]).map((row) => ({
          ...toJobPlanTaskRow(row),
          jobNumber: row.jobs?.job_number ?? null,
          jobStatus: row.jobs?.status ?? null,
        }));
      });
    },

    async spawnJob(sourceJobId, taskIds, title) {
      const { data, error } = await supabase.rpc('spawn_customer_job', {
        p_source_job: sourceJobId,
        p_task_ids: taskIds,
        p_title: title,
      });
      if (error) {
        throw new Error(`spawnJob failed: ${error.message}`);
      }
      const r = (Array.isArray(data) ? data[0] : data) as {
        id: string;
        job_number?: string | number | null;
        name?: string | null;
      };
      return { id: r.id, jobNumber: r.job_number ?? null, name: r.name ?? null };
    },

    async updateQuantity(taskRowId: string, quantity: number): Promise<JobPlanTaskRow> {
      const occurredAt = new Date().toISOString();
      const optimistic = {
        id: taskRowId,
        quantity,
      } as never as JobPlanTaskRow;
      const { data } = await writeThrough(
        'job_plan_task.update_quantity',
        { taskRowId, quantity, updatedAt: occurredAt },
        occurredAt,
        optimistic,
      );
      return data;
    },

    async removeTask(taskRowId: string): Promise<void> {
      const occurredAt = new Date().toISOString();
      await writeThrough('job_plan_task.delete', { taskRowId }, occurredAt, undefined);
    },
  };
}

export function createTimeEntryRepository(): TimeEntryRepository {
  return {
    async listForEmployee(profileId: string): Promise<TimeEntry[]> {
      return readCached('af.timeEntries.listForEmployee', { profileId }, async () => {
        const { data, error } = await supabase
          .from('job_time_entries')
          .select('*')
          .eq('tech_id', profileId)
          .order('clock_in_at', { ascending: false });
        if (error) {
          throw new Error(`listForEmployee failed: ${error.message}`);
        }
        return ((data ?? []) as TimeEntryRow[]).map(toTimeEntry);
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * ModulePorts aggregator
 * ------------------------------------------------------------------ */

function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function createJobCardExtrasRepository(): JobCardExtrasRepository {
  return {
    async listCardFlags(organizationId: string, jobIds: ReadonlyArray<string>): Promise<Record<string, JobCardFlags>> {
      if (jobIds.length === 0) return {};
      return readCached('af.jobs.cardFlags', { organizationId, jobIds }, async () => {
        const result: Record<string, JobCardFlags> = {};
        const entry = (id: string): JobCardFlags =>
          (result[id] ??= { estimateApproved: false, premCompleted: false });
        for (const ids of chunk(jobIds, 100)) {
          const [est, inv] = await Promise.all([
            supabase
              .from('job_estimates')
              .select('job_id')
              .eq('status', 'approved')
              .eq('organization_id', organizationId)
              .in('job_id', ids),
            supabase
              .from('job_investigations')
              .select('job_id')
              .not('submitted_at', 'is', null)
              .in('job_id', ids),
          ]);
          if (est.error) throw new Error(`listCardFlags job_estimates failed: ${est.error.message}`);
          if (inv.error) throw new Error(`listCardFlags job_investigations failed: ${inv.error.message}`);
          for (const r of (est.data ?? []) as Array<{ job_id: string }>) entry(r.job_id).estimateApproved = true;
          for (const r of (inv.data ?? []) as Array<{ job_id: string }>) entry(r.job_id).premCompleted = true;
        }
        return result;
      });
    },

    async listWorkTitles(organizationId: string, jobIds: ReadonlyArray<string>): Promise<Record<string, string[]>> {
      if (jobIds.length === 0) return {};
      return readCached('af.jobs.workTitles', { organizationId, jobIds }, async () => {
        const result: Record<string, string[]> = {};
        for (const ids of chunk(jobIds, 40)) {
          const { data, error } = await supabase
            .from('job_plan_tasks')
            .select('job_id,title,service_tasks(name)')
            .in('job_id', ids)
            .neq('status', 'deferred')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
          if (error) throw new Error(`listWorkTitles job_plan_tasks failed: ${error.message}`);
          for (const row of (data ?? []) as unknown as Array<{
            job_id: string;
            title: string | null;
            service_tasks: { name: string | null } | Array<{ name: string | null }> | null;
          }>) {
            const st = row.service_tasks;
            const taskName = Array.isArray(st) ? st[0]?.name : st?.name;
            const own = typeof row.title === 'string' ? row.title.trim() : '';
            const display = own || (taskName ?? '').trim();
            if (!display) continue;
            (result[row.job_id] ??= []).push(display);
          }
        }
        return result;
      });
    },
  };
}

let cachedPorts: ModulePorts | null = null;

export function buildAdminFinancePorts(session?: PayrollRepoSession): ModulePorts {
  // Payroll is session-bound, so it is layered on per call and never cached.
  const withPayroll = (base: ModulePorts): ModulePorts =>
    session
      ? {
          ...base,
          payroll: {
            ...createPayrollRepos(supabase, session),
            ...buildPayrollAdminMembers(supabase, session),
          },
        }
      : base;
  setOnlineGuard(requireOnline);
  setPaymentReviewOnlineGuard(requireOnline);
  if (cachedPorts) {
    return withPayroll(cachedPorts);
  }
  cachedPorts = {
    jobs: createJobRepository(),
    jobCardExtras: createJobCardExtrasRepository(),
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
    compensationPolicy: createCompensationPolicyRepository(),
    closeOutNotes: createCloseOutNotesRepository(),
    closeOutContactLog: createCloseOutContactLogRepository(),
    jobTimeline: createJobTimelineRepository(),
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
  return withPayroll(cachedPorts);
}
