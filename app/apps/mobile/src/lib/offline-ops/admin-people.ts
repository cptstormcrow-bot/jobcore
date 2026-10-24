/**
 * Offline-queue op handlers: admin people domain (S9b) - employees/profiles, invitations,
 * tech skills, tech service areas, time-off blackouts.
 *
 * Pure network functions - the existing direct writes from admin-finance-repos.ts / session.tsx
 * moved here verbatim. No SQLite, no React, no imports from offline-db / read-cache / sync-* /
 * session / repos files (cycle safety).
 *
 * Replay contract: errors are rethrown UNWRAPPED (the classifier reads .code/.status/.message);
 * a PK 23505 on a create is treated as "applied" by the drain, so it is never caught here;
 * updates are last-write-wins and 0 affected rows counts as applied; deletes are idempotent.
 * NOT queued (online-only): admin_set_employee_role RPC, any profile_private write.
 */

import type { Role, VehicleStatus, ToolStatus, WorkerType, TechRole, DevPayMode } from '@jobcore/core';
import { registerOpHandlers, type OpHandler } from './index';

const APPLIED = { applied: true } as const;

/* ---------------------------- payload types ---------------------------- */

export interface EmployeeUpdates {
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
  workerType?: WorkerType;
  techRole?: TechRole | null;
  devPayMode?: DevPayMode | null;
  commissionEnabled?: boolean;
  commissionPercent?: number | null;
}
export interface EmployeeUpdatePayload { profileId: string; updates: EmployeeUpdates }
export interface EmployeeDeactivatePayload { profileId: string }
export interface EmployeeReactivatePayload { profileId: string }
export interface ProfileUpdateNamePayload { userId: string; fullName: string }
/** fullName is the already-resolved value (today: fullName?.trim() || email). */
export interface InvitationCreatePayload { id: string; organizationId: string; email: string; role: Role; fullName: string }
export interface InvitationRevokePayload { invitationId: string }
export interface TechServiceAreaAssignPayload { organizationId: string; techId: string; serviceAreaId: string }
export interface TechServiceAreaRemovePayload { organizationId: string; techId: string; serviceAreaId: string }
export interface TechSkillAssignPayload { organizationId: string; techId: string; skill: string }
export interface TechSkillRemovePayload { organizationId: string; techId: string; skill: string }
export interface TimeOffRequestCreateBlackoutPayload {
  id: string;
  organizationId: string;
  techId: string;
  draft: { startDate: string; endDate: string; reason: string | null };
}
export interface TimeOffRequestAdminCancelPayload { requestId: string }

/* ------------------------------ handlers ------------------------------ */

const employeeUpdate: OpHandler<EmployeeUpdatePayload> = async ({ profileId, updates }, { supabase }) => {
  const patch: Record<string, unknown> = {};
  if (updates.fullName !== undefined) patch.full_name = updates.fullName;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.isTest !== undefined) patch.is_test = updates.isTest;
  if (updates.address !== undefined) patch.address = updates.address;
  if (updates.driversLicenseNumber !== undefined) patch.drivers_license_number = updates.driversLicenseNumber;
  if (updates.vehicleStatus !== undefined) patch.vehicle_status = updates.vehicleStatus;
  if (updates.toolStatus !== undefined) patch.tool_status = updates.toolStatus;
  if (updates.paidTravel !== undefined) patch.paid_travel = updates.paidTravel;
  if (updates.paidTravelPolicyMessage !== undefined) patch.paid_travel_policy_message = updates.paidTravelPolicyMessage;
  if (updates.defaultHourlyRateCents !== undefined) patch.hourly_rate_cents = updates.defaultHourlyRateCents;
  if (updates.testJobsOnly !== undefined) patch.test_jobs_only = updates.testJobsOnly;
  if (updates.workerType !== undefined) patch.worker_type = updates.workerType;
  if (updates.techRole !== undefined) patch.tech_role = updates.techRole;
  if (updates.devPayMode !== undefined) patch.dev_pay_mode = updates.devPayMode;
  if (updates.commissionEnabled !== undefined) patch.commission_enabled = updates.commissionEnabled;
  if (updates.commissionPercent !== undefined) patch.commission_percent = updates.commissionPercent;
  const { error } = await supabase.from('profiles').update(patch).eq('id', profileId).select('id');
  if (error) throw error;
  return APPLIED;
};

const employeeDeactivate: OpHandler<EmployeeDeactivatePayload> = async ({ profileId }, { supabase }) => {
  const { error } = await supabase.from('profiles').update({ active: false }).eq('id', profileId);
  if (error) throw error;
  return APPLIED;
};

const employeeReactivate: OpHandler<EmployeeReactivatePayload> = async ({ profileId }, { supabase }) => {
  const { error } = await supabase.from('profiles').update({ active: true }).eq('id', profileId);
  if (error) throw error;
  return APPLIED;
};

const profileUpdateName: OpHandler<ProfileUpdateNamePayload> = async ({ userId, fullName }, { supabase }) => {
  const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId).select('id');
  if (error) throw error;
  return APPLIED;
};

const invitationCreate: OpHandler<InvitationCreatePayload> = async (p, { supabase }) => {
  // invitations_pending_email_idx is a NON-PK unique: a duplicate classifies as permanent (real conflict).
  const { error } = await supabase.from('invitations').insert({
    id: p.id,
    organization_id: p.organizationId,
    email: p.email,
    role: p.role,
    full_name: p.fullName,
  });
  if (error) throw error;
  return APPLIED;
};

const invitationRevoke: OpHandler<InvitationRevokePayload> = async ({ invitationId }, { supabase }) => {
  const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
  if (error) throw error;
  return APPLIED;
};

const techServiceAreaAssign: OpHandler<TechServiceAreaAssignPayload> = async (p, { supabase }) => {
  const { error } = await supabase.from('tech_service_areas').upsert(
    { organization_id: p.organizationId, tech_id: p.techId, service_area_id: p.serviceAreaId },
    { onConflict: 'tech_id,service_area_id' },
  );
  if (error) throw error;
  return APPLIED;
};

const techServiceAreaRemove: OpHandler<TechServiceAreaRemovePayload> = async (p, { supabase }) => {
  const { error } = await supabase
    .from('tech_service_areas')
    .delete()
    .eq('organization_id', p.organizationId)
    .eq('tech_id', p.techId)
    .eq('service_area_id', p.serviceAreaId);
  if (error) throw error;
  return APPLIED;
};

const techSkillAssign: OpHandler<TechSkillAssignPayload> = async (p, { supabase }) => {
  const { error } = await supabase.from('tech_skills').upsert(
    { organization_id: p.organizationId, tech_id: p.techId, skill: p.skill },
    { onConflict: 'tech_id,skill' },
  );
  if (error) throw error;
  return APPLIED;
};

const techSkillRemove: OpHandler<TechSkillRemovePayload> = async (p, { supabase }) => {
  const { error } = await supabase
    .from('tech_skills')
    .delete()
    .eq('organization_id', p.organizationId)
    .eq('tech_id', p.techId)
    .eq('skill', p.skill);
  if (error) throw error;
  return APPLIED;
};

const timeOffCreateBlackout: OpHandler<TimeOffRequestCreateBlackoutPayload> = async (p, { supabase, userId }) => {
  const { error } = await supabase.from('time_off_requests').insert({
    id: p.id,
    organization_id: p.organizationId,
    tech_id: p.techId,
    start_date: p.draft.startDate,
    end_date: p.draft.endDate,
    reason: p.draft.reason,
    created_by_admin_id: userId,
  });
  if (error) throw error;
  return APPLIED;
};

const timeOffAdminCancel: OpHandler<TimeOffRequestAdminCancelPayload> = async ({ requestId }, { supabase }) => {
  const { error } = await supabase.from('time_off_requests').update({ status: 'cancelled' }).eq('id', requestId);
  if (error) throw error;
  return APPLIED;
};

export const ADMIN_PEOPLE_OP_HANDLERS: Record<string, OpHandler<any>> = {
  'employee.update': employeeUpdate,
  'employee.deactivate': employeeDeactivate,
  'employee.reactivate': employeeReactivate,
  'profile.update_name': profileUpdateName,
  'invitation.create': invitationCreate,
  'invitation.revoke': invitationRevoke,
  'tech_service_area.assign': techServiceAreaAssign,
  'tech_service_area.remove': techServiceAreaRemove,
  'tech_skill.assign': techSkillAssign,
  'tech_skill.remove': techSkillRemove,
  'time_off_request.create_blackout': timeOffCreateBlackout,
  'time_off_request.admin_cancel': timeOffAdminCancel,
};

registerOpHandlers(ADMIN_PEOPLE_OP_HANDLERS);
