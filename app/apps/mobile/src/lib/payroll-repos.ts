// Self-service payroll repo (PayrollSelfPort). Reads go through the offline read cache
// (time entries use the query name 'pr.time' so queued ops patch them); writes go through writeThrough.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { wageEngine } from '@jobcore/core';
import type {
  PayrollSelfPort,
  PayrollTimeEntry,
  PayrollDateRange,
  PayrollSettings,
  PayrollReimbursement,
  NewReimbursementInput,
} from '../../../../packages/payroll-ui/src/port';
import { writeThrough } from './offline-mutations';
import { cachedRead, getReadCacheIdentity, buildReadCacheKey } from './read-cache';

type Row = Record<string, any>;

export interface PayrollRepoSession {
  orgId: string;
  userId: string;
}

async function readCached<T>(queryName: string, params: Record<string, unknown>, fetchLive: () => Promise<T>): Promise<T> {
  const id = getReadCacheIdentity();
  if (!id) return fetchLive();
  const key = buildReadCacheKey(id.orgId, id.userId, queryName, params);
  const { data } = await cachedRead(key, fetchLive);
  return data;
}

function check(error: { message?: string } | null): void {
  if (error) throw new Error(error.message ?? 'Request failed');
}

export function toPayrollTimeEntry(r: Row): PayrollTimeEntry {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    workDate: (r.work_date ?? r.workDate) as wageEngine.IsoDate,
    minutes: r.minutes ?? 0,
    clockInAt: r.clock_in_at ?? r.clockInAt ?? null,
    clockOutAt: r.clock_out_at ?? r.clockOutAt ?? null,
    source: r.source === 'clock' ? 'clock' : 'manual',
    status: r.status ?? 'draft',
    notes: r.notes ?? null,
    rejectionReason: r.rejection_reason ?? r.rejectionReason ?? null,
  };
}

function toReimbursement(r: Row): PayrollReimbursement {
  return {
    id: r.id,
    userId: r.user_id,
    amountCents: r.amount_cents,
    description: r.description ?? '',
    jobId: r.job_id ?? null,
    receiptPhotoPath: r.receipt_photo_path ?? null,
    status: r.status,
    rejectionReason: r.rejection_reason ?? null,
    createdAt: r.created_at,
  };
}

function toRunLine(r: Row, name: string): wageEngine.RunLine {
  const segs = Array.isArray(r.rate_segments) ? (r.rate_segments as wageEngine.RateSegment[]) : [];
  return {
    userId: r.user_id,
    employeeName: r.employee_name ?? name,
    regularMin: r.regular_minutes ?? 0,
    otMin: r.ot_minutes ?? 0,
    dtMin: r.dt_minutes ?? 0,
    segments: segs,
    grossCents: r.hours_amount ?? 0,
    reimbursementCents: r.reimbursement_amount ?? 0,
    totalCents: r.total_amount ?? 0,
  };
}

function extOf(uri: string): string {
  const m = /\.([A-Za-z0-9]+)(?:\?.*)?$/.exec(uri);
  return m?.[1] ? m[1].toLowerCase() : 'jpg';
}

export function createPayrollRepos(supabase: SupabaseClient, session: PayrollRepoSession): PayrollSelfPort {
  const { orgId, userId } = session;

  const receiptPath = (uri: string, reimbursementId: string) => `${orgId}/${userId}/${reimbursementId}.${extOf(uri)}`;

  return {
    async listEntries(range: PayrollDateRange) {
      return readCached('pr.time', { from: range.from, to: range.to }, async () => {
        const { data, error } = await supabase
          .from('payroll_time_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('work_date', range.from)
          .lte('work_date', range.to)
          .order('work_date', { ascending: true });
        check(error);
        return ((data ?? []) as Row[]).map(toPayrollTimeEntry);
      });
    },

    async upsertEntry(entry) {
      const occurredAt = new Date().toISOString();
      await writeThrough(
        'payroll_time.upsert',
        {
          id: entry.id,
          userId: entry.userId,
          workDate: entry.workDate,
          minutes: entry.minutes,
          clockInAt: entry.clockInAt,
          clockOutAt: entry.clockOutAt,
          source: entry.source,
          notes: entry.notes ?? null,
        },
        occurredAt,
        entry,
      );
    },

    async deleteEntry(id) {
      await writeThrough('payroll_time.delete', { id }, new Date().toISOString(), undefined);
    },

    async submitWeek(range) {
      await writeThrough(
        'payroll_timesheet.submit',
        { id: `${userId}:${range.from}:${range.to}`, weekStart: range.from, weekEnd: range.to },
        new Date().toISOString(),
        undefined,
      );
    },

    async withdrawWeek(range) {
      await writeThrough(
        'payroll_timesheet.withdraw',
        { id: `${userId}:${range.from}:${range.to}`, weekStart: range.from, weekEnd: range.to },
        new Date().toISOString(),
        undefined,
      );
    },

    async getRateHistory(forUserId) {
      const uid = forUserId ?? userId;
      return readCached('pr.rateHistory', { uid }, async () => {
        const { data, error } = await supabase
          .from('employee_rate_history')
          .select('effective_from, hourly_rate_cents')
          .eq('user_id', uid)
          .order('effective_from', { ascending: true });
        check(error);
        const rows = ((data ?? []) as Row[]).map((r) => ({
          effectiveFrom: r.effective_from as wageEngine.IsoDate,
          hourlyRateCents: r.hourly_rate_cents as number,
        }));
        if (rows.length > 0) return rows;
        // Fallback: roster column profiles.hourly_rate_cents (Employee editor).
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('hourly_rate_cents')
          .eq('id', uid)
          .maybeSingle();
        if (profErr) return rows;
        const cents = (prof as Row | null)?.hourly_rate_cents;
        if (typeof cents === 'number' && cents > 0) {
          return [{ effectiveFrom: '1970-01-01' as wageEngine.IsoDate, hourlyRateCents: cents }];
        }
        return rows;
      });
    },

    async getSettings(): Promise<PayrollSettings> {
      return readCached('pr.settings', {}, async () => {
        const { data, error } = await supabase.from('payroll_settings').select('*').maybeSingle();
        check(error);
        const r = (data ?? {}) as Row;
        return {
          overtime: {
            dailyOtAfterMin: r.ot_daily_after_min ?? 480,
            dailyDtAfterMin: r.dt_daily_after_min ?? 720,
            weeklyOtAfterMin: r.ot_weekly_after_min ?? 2400,
            seventhDayRule: r.seventh_day_rule ?? true,
          },
          payWeek: {
            weekStartDow: r.week_start_dow ?? 1,
            anchorDate: (r.period_anchor_date ?? '2024-01-01') as wageEngine.IsoDate,
          },
        };
      });
    },

    async listRunLines(range) {
      return readCached('pr.runLines', { from: range.from, to: range.to }, async () => {
        const { data, error } = await supabase
          .from('payout_lines')
          .select('*, payout_batches!inner(period_start, period_end)')
          .eq('user_id', userId)
          .gte('payout_batches.period_start', range.from)
          .lte('payout_batches.period_end', range.to);
        check(error);
        return ((data ?? []) as Row[]).map((r) => toRunLine(r, ''));
      });
    },

    async listMyReimbursements() {
      return readCached('pr.reimbursements', {}, async () => {
        const { data, error } = await supabase
          .from('reimbursements')
          .select('id, user_id, amount_cents, description, job_id, receipt_photo_path, status, rejection_reason, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        check(error);
        return ((data ?? []) as Row[]).map(toReimbursement);
      });
    },

    async submitReimbursement(input: NewReimbursementInput) {
      if (!input.receiptUri) throw new Error('receipt photo required');
      const occurredAt = new Date().toISOString();
      const path = receiptPath(input.receiptUri, input.id);
      const optimistic: PayrollReimbursement = {
        id: input.id,
        userId,
        amountCents: input.amountCents,
        description: input.description,
        jobId: input.jobId ?? null,
        receiptPhotoPath: path,
        status: 'pending',
        rejectionReason: null,
        createdAt: occurredAt,
      };
      await writeThrough(
        'reimbursement.create',
        {
          id: input.id,
          techId: userId,
          jobId: input.jobId ?? null,
          amountCents: input.amountCents,
          description: input.description,
          receiptPhotoPath: input.receiptUri,
        },
        occurredAt,
        optimistic,
      );
    },

    async uploadReceipt(localUri, reimbursementId) {
      return receiptPath(localUri, reimbursementId);
    },
  };
}
