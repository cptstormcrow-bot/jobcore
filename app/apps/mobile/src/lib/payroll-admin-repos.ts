// Admin payroll members (PayrollAdminPort). Admin writes are never queued and require internet; the reimbursements list reads through the offline cache.
import type { SupabaseClient } from '@supabase/supabase-js';
import { wageEngine } from '@jobcore/core';
import type {
  PayrollAdminPort,
  PayrollDateRange,
  PayrollSettings,
  PayrollExportFormat,
  TeamWeek,
  PayrollEntryStatus,
  AdminReimbursement,
} from '../../../../packages/payroll-ui/src/port';
import { requireOnline } from './offline-mutations';
import { readCached, toPayrollTimeEntry } from './payroll-repos';
import type { PayrollRepoSession } from './payroll-repos';

type Row = Record<string, any>;

function check(error: { message?: string } | null): void {
  if (error) throw new Error(error.message ?? 'Request failed');
}

function rollupStatus(statuses: PayrollEntryStatus[]): PayrollEntryStatus {
  if (statuses.length === 0) return 'draft';
  for (const s of ['rejected', 'draft', 'submitted'] as PayrollEntryStatus[]) {
    if (statuses.includes(s)) return s;
  }
  return 'approved';
}

export function buildPayrollAdminMembers(supabase: SupabaseClient, session: PayrollRepoSession): Required<PayrollAdminPort> {
  const { orgId, userId } = session;

  async function loadSettings(): Promise<PayrollSettings> {
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
  }

  async function nameMap(): Promise<Map<string, string>> {
    const { data, error } = await supabase.from('profiles').select('id, full_name').eq('organization_id', orgId);
    check(error);
    return new Map(((data ?? []) as Row[]).map((r) => [r.id as string, (r.full_name ?? '') as string]));
  }

  return {
    async listTeamEntries(range: PayrollDateRange): Promise<TeamWeek[]> {
      requireOnline('load the team timesheets');
      const [settings, names] = await Promise.all([loadSettings(), nameMap()]);
      const { data, error } = await supabase
        .from('payroll_time_entries')
        .select('*')
        .eq('organization_id', orgId)
        .gte('work_date', range.from)
        .lte('work_date', range.to)
        .order('work_date', { ascending: true });
      check(error);
      const groups = new Map<string, TeamWeek>();
      for (const r of (data ?? []) as Row[]) {
        const e = toPayrollTimeEntry(r);
        const weekStart = wageEngine.weekStartOf(e.workDate, settings.payWeek);
        const key = `${e.userId}|${weekStart}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            userId: e.userId,
            employeeName: names.get(e.userId) ?? '',
            weekStart,
            weekEnd: wageEngine.weekEndOf(e.workDate, settings.payWeek),
            entries: [],
            status: 'draft',
          };
          groups.set(key, g);
        }
        g.entries.push(e);
      }
      const weeks = [...groups.values()];
      for (const w of weeks) w.status = rollupStatus(w.entries.map((e) => e.status));
      return weeks;
    },

    async approveWeek(forUserId, range) {
      requireOnline('approve this week');
      const { error } = await supabase.rpc('approve_timesheet', {
        p_user_id: forUserId,
        p_week_start: range.from,
        p_week_end: range.to,
      });
      check(error);
    },

    async rejectWeek(forUserId, range, reason) {
      requireOnline('reject this week');
      const { error } = await supabase.rpc('reject_timesheet', {
        p_user_id: forUserId,
        p_week_start: range.from,
        p_week_end: range.to,
        p_reason: reason ?? null,
      });
      check(error);
    },

    async deleteWeek(forUserId, range) {
      requireOnline('delete this week');
      const { error } = await supabase.rpc('delete_timesheet', {
        p_user_id: forUserId,
        p_week_start: range.from,
        p_week_end: range.to,
      });
      check(error);
    },

    async setRate(forUserId, hourlyRateCents, effectiveFrom) {
      requireOnline('change a pay rate');
      const { error } = await supabase.rpc('set_employee_rate', {
        p_user_id: forUserId,
        p_cents: hourlyRateCents,
        p_effective_from: effectiveFrom,
      });
      check(error);
    },

    async saveSettings(settings) {
      requireOnline('save payroll settings');
      const { error } = await supabase.from('payroll_settings').upsert(
        {
          organization_id: orgId,
          week_start_dow: settings.payWeek.weekStartDow,
          period_anchor_date: settings.payWeek.anchorDate,
          ot_daily_after_min: settings.overtime.dailyOtAfterMin,
          dt_daily_after_min: settings.overtime.dailyDtAfterMin,
          ot_weekly_after_min: settings.overtime.weeklyOtAfterMin,
          seventh_day_rule: settings.overtime.seventhDayRule,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      );
      check(error);
    },

    async getQbAccountMap() {
      requireOnline('load the QuickBooks accounts');
      const { data, error } = await supabase.from('payroll_qb_account_map').select('*').maybeSingle();
      check(error);
      const r = (data ?? {}) as Row;
      return {
        wages_expense: r.wages_expense ?? 'Payroll Expenses',
        reimbursement_expense: r.reimbursement_expense ?? 'Reimbursements',
        payroll_payable: r.payroll_payable ?? 'Payroll Liabilities',
      };
    },

    async setQbAccountMap(map) {
      requireOnline('save the QuickBooks accounts');
      const { error } = await supabase.from('payroll_qb_account_map').upsert(
        {
          organization_id: orgId,
          wages_expense: map.wages_expense,
          reimbursement_expense: map.reimbursement_expense,
          payroll_payable: map.payroll_payable,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      );
      check(error);
    },

    async closeRun(range) {
      requireOnline('close the payroll run');
      const [settings, names] = await Promise.all([loadSettings(), nameMap()]);

      const { data: entryData, error: entryErr } = await supabase
        .from('payroll_time_entries')
        .select('*')
        .eq('organization_id', orgId)
        .eq('status', 'approved')
        .gte('work_date', range.from)
        .lte('work_date', range.to);
      check(entryErr);

      const { data: rateData, error: rateErr } = await supabase
        .from('employee_rate_history')
        .select('user_id, effective_from, hourly_rate_cents')
        .eq('organization_id', orgId)
        .order('effective_from', { ascending: true });
      check(rateErr);

      const { data: reimbData, error: reimbErr } = await supabase
        .from('reimbursements')
        .select('id, user_id, amount_cents')
        .eq('organization_id', orgId)
        .eq('status', 'approved');
      check(reimbErr);

      const minutesByUser = new Map<string, Map<string, number>>();
      for (const r of (entryData ?? []) as Row[]) {
        const e = toPayrollTimeEntry(r);
        let byDate = minutesByUser.get(e.userId);
        if (!byDate) {
          byDate = new Map();
          minutesByUser.set(e.userId, byDate);
        }
        byDate.set(e.workDate, (byDate.get(e.workDate) ?? 0) + e.minutes);
      }

      const ratesByUser = new Map<string, wageEngine.RateChange[]>();
      for (const r of (rateData ?? []) as Row[]) {
        const list = ratesByUser.get(r.user_id) ?? [];
        list.push({ effectiveFrom: r.effective_from as wageEngine.IsoDate, hourlyRateCents: r.hourly_rate_cents as number });
        ratesByUser.set(r.user_id, list);
      }

      const reimbByUser = new Map<string, { ids: string[]; cents: number }>();
      for (const r of (reimbData ?? []) as Row[]) {
        const cur = reimbByUser.get(r.user_id) ?? { ids: [], cents: 0 };
        cur.ids.push(r.id);
        cur.cents += r.amount_cents as number;
        reimbByUser.set(r.user_id, cur);
      }

      const lines: Array<{ line: wageEngine.RunLine; reimbursementIds: string[] }> = [];
      const userIds = new Set<string>([...minutesByUser.keys(), ...reimbByUser.keys()]);
      for (const uid of userIds) {
        const byDate = minutesByUser.get(uid) ?? new Map<string, number>();
        const byWeek = new Map<string, wageEngine.WorkedDay[]>();
        for (const [date, minutes] of byDate) {
          const ws = wageEngine.weekStartOf(date as wageEngine.IsoDate, settings.payWeek);
          const arr = byWeek.get(ws) ?? [];
          arr.push({ workDate: date as wageEngine.IsoDate, minutes });
          byWeek.set(ws, arr);
        }
        const days: wageEngine.DayAllocation[] = [];
        for (const [ws, worked] of byWeek) {
          days.push(...wageEngine.allocateWorkweek(worked, settings.overtime, ws as wageEngine.IsoDate).days);
        }
        const reimb = reimbByUser.get(uid) ?? { ids: [], cents: 0 };
        const line = wageEngine.buildRunLine({
          userId: uid,
          employeeName: names.get(uid) ?? '',
          days,
          rateHistory: ratesByUser.get(uid) ?? [],
          reimbursementCents: reimb.cents,
        });
        lines.push({ line, reimbursementIds: reimb.ids });
      }

      const pLines = lines.map(({ line, reimbursementIds }) => ({
        user_id: line.userId,
        employee_name: line.employeeName,
        regular_minutes: line.regularMin,
        ot_minutes: line.otMin,
        dt_minutes: line.dtMin,
        rate_segments: line.segments,
        hours_amount: line.grossCents,
        reimbursement_amount: line.reimbursementCents,
        reimbursement_ids: reimbursementIds,
      }));

      const { data, error } = await supabase.rpc('create_payout_batch', {
        p_period_start: range.from,
        p_period_end: range.to,
        p_lines: pLines,
      });
      check(error);
      const batch = (Array.isArray(data) ? data[0] : data) as Row;
      return { batchId: batch.id as string };
    },

    async exportRun(batchId: string, format: PayrollExportFormat) {
      requireOnline('export the payroll run');
      const { data: batch, error: bErr } = await supabase
        .from('payout_batches')
        .select('id, period_start, period_end')
        .eq('id', batchId)
        .single();
      check(bErr);
      const { data: lineData, error: lErr } = await supabase.from('payout_lines').select('*').eq('payout_batch_id', batchId);
      check(lErr);
      const runLines: wageEngine.RunLine[] = ((lineData ?? []) as Row[]).map((r) => ({
        userId: r.user_id,
        employeeName: r.employee_name ?? '',
        regularMin: r.regular_minutes ?? 0,
        otMin: r.ot_minutes ?? 0,
        dtMin: r.dt_minutes ?? 0,
        segments: Array.isArray(r.rate_segments) ? (r.rate_segments as wageEngine.RateSegment[]) : [],
        grossCents: r.hours_amount ?? 0,
        reimbursementCents: r.reimbursement_amount ?? 0,
        ...((r.bonus_amount ?? 0) > 0 ? { bonusCents: r.bonus_amount as number } : {}),
        totalCents: r.total_amount ?? 0,
      }));
      const exp = wageEngine.buildCanonicalExport({
        batchId,
        periodStart: (batch as Row).period_start as wageEngine.IsoDate,
        periodEnd: (batch as Row).period_end as wageEngine.IsoDate,
        lines: runLines,
      });
      const { error } = await supabase.from('payroll_export_log').upsert(
        {
          organization_id: orgId,
          batch_id: batchId,
          format,
          source_hash: exp.sourceHash,
          exported_by: userId,
        },
        { onConflict: 'batch_id,format,source_hash', ignoreDuplicates: true },
      );
      check(error);
      return exp;
    },

    async listAllReimbursements(): Promise<AdminReimbursement[]> {
      return readCached('pr.admin.reimbursements', {}, async () => {
        const { data, error } = await supabase
          .from('reimbursements')
          .select('id, user_id, amount_cents, description, job_id, receipt_photo_path, status, rejection_reason, created_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false });
        check(error);
        const names = await nameMap();
        return ((data ?? []) as Row[]).map((r) => ({
          id: r.id,
          userId: r.user_id,
          amountCents: r.amount_cents,
          description: r.description,
          jobId: r.job_id,
          receiptPhotoPath: r.receipt_photo_path,
          status: r.status,
          rejectionReason: r.rejection_reason,
          createdAt: r.created_at,
          employeeName: names.get(r.user_id as string) ?? '',
        })) as AdminReimbursement[];
      });
    },

    async getReceiptUrl(path: string): Promise<string | null> {
      requireOnline('load the receipt');
      if (!path) return null;
      if (
        path.length > 200 ||
        !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[^/]+\.[A-Za-z0-9]{2,5}$/i.test(path)
      ) {
        return null;
      }
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 600);
      if (error) throw new Error(error.message);
      return data?.signedUrl ?? null;
    },
  };
}
