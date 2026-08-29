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
import { getBoolPref, setBoolPref } from './local-prefs';
import { makeIdempotencyKey } from '@jobcore/core';
import type { NewQueuedMutation, Job, Commission, JobStatus, Profile, Role, VehicleStatus, ToolStatus } from '@jobcore/core';
import type {
  JobRepository,
  JobRow,
  JobSchedulingPatch,
  JobDetailsPatch,
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
  InvitationRepository,
  Invitation,
  TechSkillRepository,
} from '../../../../modules/admin-finance/src/data/ports';
import { toJob, toAuditLogEntry, toPayment, toCustomer, isVehicleStatus, isToolStatus } from '../../../../modules/admin-finance/src/data/ports';
import type { ModulePorts } from '../../../../modules/admin-finance/src/lib/module-ports';
import { getModuleSession } from '../../../../modules/admin-finance/src/lib/module-session';
import type { PriceSheet } from '../../../../modules/admin-finance/src/money/types';
import type { PayPeriod } from '../../../../modules/admin-finance/src/money/rollup';
import type { Lead } from '../../../../modules/admin-finance/src/domain/lead';
import type { JobDraft } from '../../../../modules/admin-finance/src/domain/qualify';
import type { NewLeadDraft } from '../../../../modules/admin-finance/src/domain/intake-normalize';
import type { CommissionLine } from '../../../../modules/admin-finance/src/money/types';
import type {
  PriceSheetRepo,
  PriceSheetRow,
  PriceSheetRateRow,
} from '../../../../modules/admin-finance/src/data/price-sheet-repo';
import { toPriceSheet, toPriceSheetRate, applyPublishPlanViaRpc, listAreaAdjustments, saveAreaAdjustment } from '../../../../modules/admin-finance/src/data/price-sheet-repo';
import type {
  ReimbursementRepo,
  ReimbursementRow,
} from '../../../../modules/admin-finance/src/data/reimbursement-repo';
import { toReimbursement, approveReimbursementViaRpc, rejectReimbursementViaRpc } from '../../../../modules/admin-finance/src/data/reimbursement-repo';
import type {
  PayoutBatchRepo,
  PayoutBatchRow,
  PayoutLineRow,
} from '../../../../modules/admin-finance/src/data/payout-batch-repo';
import { toPayoutBatch, persistPayoutBatchViaRpc } from '../../../../modules/admin-finance/src/data/payout-batch-repo';
import type {
  TimeOffAdminRepo,
  TimeOffRequestAdminRow,
} from '../../../../modules/admin-finance/src/data/time-off-repo';
import { toTimeOffRequestAdmin } from '../../../../modules/admin-finance/src/data/time-off-repo';
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

    async updateDetails(jobId: string, patch: JobDetailsPatch): Promise<Job> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('job.update_details', occurredAt, { jobId, patch });

      const { data, error } = await supabase
        .from('jobs')
        .update({
          address: patch.address,
          description: patch.description,
          house_age_years: patch.houseAgeYears,
        })
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

    async create(draft: import('../../../../modules/admin-finance/src/data/ports').PriceSheetDraft): Promise<PriceSheet> {
      const { data, error } = await supabase
        .from('price_sheets')
        .insert({
          organization_id: draft.organizationId,
          version: draft.version,
        })
        .select('*')
        .single();
      if (error) {
        throw new Error(`create failed: ${error.message}`);
      }
      return data as PriceSheet;
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
 * EmployeeRepository
 * ------------------------------------------------------------------ */

function toProfile(row: {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  active: boolean;
  is_test: boolean;
  created_at: string;
  address: string | null;
  drivers_license_number: string | null;
  vehicle_status: string | null;
  tool_status: string | null;
}): Profile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    active: row.active,
    isTest: row.is_test,
    createdAt: row.created_at,
    address: row.address,
    driversLicenseNumber: row.drivers_license_number,
    vehicleStatus: row.vehicle_status && isVehicleStatus(row.vehicle_status) ? row.vehicle_status : null,
    toolStatus: row.tool_status && isToolStatus(row.tool_status) ? row.tool_status : null,
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

      const { error } = await supabase.from('profiles').update(patch).eq('id', profileId);
      if (error) {
        logSyncFailure('admin-finance-repos.updateEmployee', error.message, { profileId, updates });
        throw new Error(`updateEmployee failed: ${error.message}`);
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

export function createInvitationRepository(): InvitationRepository {
  return {
    async createInvitation(organizationId: string, email: string, role: Role): Promise<void> {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('invitation.create', occurredAt, { organizationId, email, role });

      const { error } = await supabase.from('invitations').insert({
        organization_id: organizationId,
        email,
        role,
        // `invitations.full_name` is NOT NULL (app/supabase/0003_invitations_and_signup.sql)
        // but InvitationRepository.createInvitation carries no fullName param —
        // see GAPS FOUND in the delivering build report.
        full_name: email,
      });
      if (error) {
        logSyncFailure('admin-finance-repos.createInvitation', error.message, { organizationId, email, role });
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

    async approve(input) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('reimbursement.approve', occurredAt, input);
      const result = await approveReimbursementViaRpc(supabase as unknown as Parameters<typeof approveReimbursementViaRpc>[0], input);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.approveReimbursement', result.reason, { input });
      }
      return result;
    },

    async reject(input) {
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

    async persist(batch) {
      const occurredAt = new Date().toISOString();
      await enqueueMutation('payout_batch.persist', occurredAt, batch);
      const result = await persistPayoutBatchViaRpc(supabase as unknown as Parameters<typeof persistPayoutBatchViaRpc>[0], batch);
      if (!result.ok) {
        logSyncFailure('admin-finance-repos.persistPayoutBatch', result.reason, { batch });
      }
      return result;
    },

    async approve(batchId) {
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

    async markPaid(batchId) {
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
 * payment-review module). Read-only, mirrors createAuditLogRepository's
 * shape: no enqueueMutation (nothing is written here), maps rows via
 * toPayment (throws on an unrecognized status — fail closed).
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
        .select('id, organization_id, tech_id, start_date, end_date, reason, status, created_at, updated_at')
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
        throw new Error(`create blackout failed to resolve current user: ${userError?.message ?? 'no session'}`);
      }

      const { data, error } = await supabase
        .from('time_off_requests')
        .insert({
          organization_id: organizationId,
          tech_id: techId,
          start_date: draft.startDate,
          end_date: draft.endDate,
          reason: draft.reason,
          created_by_admin_id: userData.user.id,
          status: 'pending',
        })
        .select('*')
        .single();
      if (error) {
        logSyncFailure('admin-finance-repos.createBlackout', error.message, { organizationId, techId });
        throw new Error(`create blackout failed: ${error.message}`);
      }
      return toTimeOffRequestAdmin(data as TimeOffRequestAdminRow);
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
    reimbursements: createReimbursementsRepository(),
    payoutBatches: createPayoutBatchesRepository(),
    closeOutPhotos: createCloseOutPhotosRepository(),
    closeOutNotes: createCloseOutNotesRepository(),
    payments: createPaymentsRepository(),
    calendarEvents: createCalendarEventRepository(),
    timeOffAdmin: createTimeOffAdminRepository(),
    techServiceAreas: createTechServiceAreaRepository(),
    techSkills: createTechSkillRepository(),
    serviceAreas: createServiceAreaRepository(),
    customers: createCustomerRepository(),
    localPrefs: {
      getBool: getBoolPref,
      setBool: setBoolPref,
    },
  };
  return cachedPorts;
}
