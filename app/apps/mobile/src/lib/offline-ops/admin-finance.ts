/**
 * Offline-queue op handlers: admin finance domain (S9c).
 *
 * Pure network functions - the existing direct writes from admin-finance-repos.ts and the
 * admin-finance module repos moved here, minus the pre-write enqueue, the read-back and the
 * Result-wrapping. No SQLite, no React, no imports from offline-db / read-cache / sync-* /
 * repos files (cycle safety).
 *
 * Replay contract: errors are rethrown UNWRAPPED (the classifier reads .code/.status/.message);
 * a PK 23505 on a create is treated as "applied" by the drain, so it is never caught here;
 * updates are last-write-wins and 0 affected rows counts as applied; deletes are idempotent.
 *
 * ONLINE-ONLY (no handler, by W0 verdict): close_out_job_write, create_payout_batch (persist),
 * publish_price_sheet (applyPublishPlan), approve_reimbursement, reject_reimbursement,
 * resolve_close_out_failure_manual, reset_job_time_segments.
 */

import { registerOpHandlers, type OpHandler } from './index';

const APPLIED = { applied: true } as const;

/* ---------------------------- payload types ---------------------------- */

/** Minimal local copy of the module's service-task extras (kept local: no repo imports). */
export interface ServiceTaskExtra {
  estimatedMinutes?: number | null;
  rate?: number | null;
  category?: string | null;
  active?: boolean;
  priceCents?: number | null;
  details?: string | null;
  materials?: string | null;
}

export interface PriceSheetCreatePayload { id: string; version: number; status?: string }
export interface PriceSheetRateCreatePayload {
  id: string; priceSheetId: string; serviceId: string; taskId: string | null;
  attachTiming: string; amount: number; timeEstimateMinutes: number | null;
}
export interface PriceSheetRateUpdatePayload {
  id: string; priceSheetId: string; serviceId: string; taskId: string | null;
  attachTiming: string; amount: number; timeEstimateMinutes: number | null;
}
export interface PriceSheetRateDeletePayload { id: string }
export interface PriceSheetAreaAdjustmentUpsertPayload {
  priceSheetId: string; serviceAreaId: string; adjustmentType: 'percent' | 'flat';
  adjustmentValue: number; updatedAt: string;
}
export interface PriceSheetAreaAdjustmentDeletePayload { id: string }
export interface PriceSheetStandardDurationUpsertPayload { standardMinutes: number; updatedAt: string }
export interface ServiceTaskCreatePayload { id: string; serviceId: string; name: string; extra?: ServiceTaskExtra }
export interface ServiceTaskUpdatePayload { id: string; patch: ServiceTaskExtra & { name?: string } }
export interface ServiceTaskDeletePayload { id: string }
export interface PayoutBatchApprovePayload { batchId: string }
export interface PayoutBatchMarkPaidPayload { batchId: string }
export interface CloseOutFailureCreatePayload {
  id: string; jobId: string; stage: string; reason: string;
}
export interface CloseOutFailureUpdatePayload { jobId: string; stage: string; reason: string; occurredAt: string }
export interface CloseOutFailureRecordAttemptPayload { jobId: string; occurredAt: string }
export interface CloseOutFailureResolveRetryPayload {
  jobId: string; resolvedBy: string; note?: string | null; occurredAt: string;
}
export interface PaymentRecordManualPayload {
  id: string; jobId: string; amount: number; confirmedAt: string; method?: string | null;
}

/* ------------------------------ helpers ------------------------------ */

const OPEN_STATUSES = ['open', 'retrying'];

const SERVICE_TASK_COLUMNS: Record<string, string> = {
  name: 'name',
  estimatedMinutes: 'estimated_minutes',
  rate: 'rate',
  category: 'category',
  active: 'active',
  priceCents: 'price_cents',
  details: 'details',
  materials: 'materials',
};

function serviceTaskColumns(src: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!src) return out;
  for (const key of Object.keys(SERVICE_TASK_COLUMNS)) {
    if (key in src) out[SERVICE_TASK_COLUMNS[key]!] = src[key];
  }
  return out;
}

/* ------------------------------ handlers ------------------------------ */

export const ADMIN_FINANCE_OP_HANDLERS: Record<string, OpHandler<any>> = {
  'price_sheet.create': async (p: PriceSheetCreatePayload, { supabase, orgId }) => {
    const { error } = await supabase.from('price_sheets').insert({
      id: p.id,
      organization_id: orgId,
      version: p.version,
      status: p.status ?? 'draft',
    });
    if (error) throw error;
    return APPLIED;
  },

  'price_sheet_rate.create': async (p: PriceSheetRateCreatePayload, { supabase }) => {
    const { error } = await supabase.from('price_sheet_rates').insert({
      id: p.id,
      price_sheet_id: p.priceSheetId,
      service_id: p.serviceId,
      task_id: p.taskId,
      attach_timing: p.attachTiming,
      amount_cents: p.amount,
      estimated_minutes: p.timeEstimateMinutes,
    });
    if (error) throw error;
    return APPLIED;
  },

  'price_sheet_rate.update': async (p: PriceSheetRateUpdatePayload, { supabase }) => {
    const { error } = await supabase
      .from('price_sheet_rates')
      .update({
        price_sheet_id: p.priceSheetId,
        service_id: p.serviceId,
        task_id: p.taskId,
        attach_timing: p.attachTiming,
        amount_cents: p.amount,
        estimated_minutes: p.timeEstimateMinutes,
      })
      .eq('id', p.id)
      .select('id');
    if (error) throw error;
    return APPLIED;
  },

  'price_sheet_rate.delete': async (p: PriceSheetRateDeletePayload, { supabase }) => {
    const { error } = await supabase.from('price_sheet_rates').delete().eq('id', p.id);
    if (error) throw error;
    return APPLIED;
  },

  'price_sheet_area_adjustment.upsert': async (
    p: PriceSheetAreaAdjustmentUpsertPayload,
    { supabase, orgId },
  ) => {
    const { error } = await supabase.from('price_sheet_area_adjustments').upsert(
      {
        price_sheet_id: p.priceSheetId,
        service_area_id: p.serviceAreaId,
        adjustment_type: p.adjustmentType,
        adjustment_value: p.adjustmentValue,
        organization_id: orgId,
        updated_at: p.updatedAt,
      },
      { onConflict: 'price_sheet_id,service_area_id' },
    );
    if (error) throw error;
    return APPLIED;
  },

  'price_sheet_area_adjustment.delete': async (p: PriceSheetAreaAdjustmentDeletePayload, { supabase }) => {
    const { error } = await supabase.from('price_sheet_area_adjustments').delete().eq('id', p.id);
    if (error) throw error;
    return APPLIED;
  },

  'price_sheet_standard_duration.upsert': async (
    p: PriceSheetStandardDurationUpsertPayload,
    { supabase, orgId },
  ) => {
    const { error } = await supabase.from('price_sheet_standard_duration').upsert(
      { organization_id: orgId, standard_minutes: p.standardMinutes, updated_at: p.updatedAt },
      { onConflict: 'organization_id' },
    );
    if (error) throw error;
    return APPLIED;
  },

  'service_task.create': async (p: ServiceTaskCreatePayload, { supabase, orgId }) => {
    const { error } = await supabase.from('service_tasks').insert({
      id: p.id,
      organization_id: orgId,
      service_id: p.serviceId,
      name: p.name,
      ...serviceTaskColumns(p.extra as Record<string, unknown> | undefined),
    });
    if (error) throw error;
    return APPLIED;
  },

  'service_task.update': async (p: ServiceTaskUpdatePayload, { supabase }) => {
    const { error } = await supabase
      .from('service_tasks')
      .update(serviceTaskColumns(p.patch as Record<string, unknown>))
      .eq('id', p.id)
      .select('id');
    if (error) throw error;
    return APPLIED;
  },

  'service_task.delete': async (p: ServiceTaskDeletePayload, { supabase }) => {
    const { error } = await supabase.from('service_tasks').delete().eq('id', p.id);
    if (error) throw error;
    return APPLIED;
  },

  'payout_batch.approve': async (p: PayoutBatchApprovePayload, { supabase }) => {
    const { error } = await supabase
      .from('payout_batches')
      .update({ status: 'approved' })
      .eq('id', p.batchId)
      .select('id');
    if (error) throw error;
    return APPLIED;
  },

  'payout_batch.mark_paid': async (p: PayoutBatchMarkPaidPayload, { supabase }) => {
    const { error } = await supabase
      .from('payout_batches')
      .update({ status: 'paid' })
      .eq('id', p.batchId)
      .select('id');
    if (error) throw error;
    return APPLIED;
  },

  'close_out_failure.create': async (p: CloseOutFailureCreatePayload, { supabase, orgId }) => {
    const { error } = await supabase.from('close_out_failures').insert({
      id: p.id,
      organization_id: orgId,
      job_id: p.jobId,
      stage: p.stage,
      reason: p.reason,
      status: 'open',
    });
    if (error) throw error;
    return APPLIED;
  },

  'close_out_failure.update': async (p: CloseOutFailureUpdatePayload, { supabase }) => {
    const { error } = await supabase
      .from('close_out_failures')
      .update({ stage: p.stage, reason: p.reason, updated_at: p.occurredAt })
      .eq('job_id', p.jobId)
      .in('status', OPEN_STATUSES)
      .select('id');
    if (error) throw error;
    return APPLIED;
  },

  'close_out_failure.record_attempt': async (p: CloseOutFailureRecordAttemptPayload, { supabase }) => {
    const { data, error: readError } = await supabase
      .from('close_out_failures')
      .select('id, attempts')
      .eq('job_id', p.jobId)
      .in('status', OPEN_STATUSES)
      .maybeSingle();
    if (readError) throw readError;
    if (!data) return APPLIED;
    const { error } = await supabase
      .from('close_out_failures')
      .update({
        attempts: (data.attempts ?? 0) + 1,
        last_attempted_at: p.occurredAt,
        status: 'retrying',
        updated_at: p.occurredAt,
      })
      .eq('id', data.id)
      .select('id');
    if (error) throw error;
    return APPLIED;
  },

  'close_out_failure.resolve_retry': async (p: CloseOutFailureResolveRetryPayload, { supabase }) => {
    const { error } = await supabase
      .from('close_out_failures')
      .update({
        status: 'resolved_retry',
        resolved_by: p.resolvedBy,
        resolved_at: p.occurredAt,
        resolution_note: p.note ?? null,
        updated_at: p.occurredAt,
      })
      .eq('job_id', p.jobId)
      .in('status', OPEN_STATUSES)
      .select('id');
    if (error) throw error;
    return APPLIED;
  },

  'payment.record_manual': async (p: PaymentRecordManualPayload, { supabase, orgId, userId }) => {
    const { error } = await supabase.from('payments').insert({
      id: p.id,
      organization_id: orgId,
      job_id: p.jobId,
      provider_id: 'manual',
      amount: p.amount,
      status: 'manual_confirmed',
      method: p.method ?? null,
      external_ref: null,
      confirmed_at: p.confirmedAt,
      confirmed_by: userId,
    });
    if (error) throw error;
    return APPLIED;
  },
};

registerOpHandlers(ADMIN_FINANCE_OP_HANDLERS);
