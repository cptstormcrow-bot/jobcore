// Admin payroll members (PayrollAdminPort). Admin writes are never queued and require internet; the reimbursements list reads through the offline cache.
import type { SupabaseClient } from '@supabase/supabase-js';
import { wageEngine } from '@jobcore/core';
import type {
  PayrollAdminPort,
  PayrollDateRange,
  PayrollSettings,
  PayrollExportFormat,
  TeamWeek,
  SystemHoursRow,
  PayrollEntryStatus,
  AdminReimbursement,
} from '../../../../packages/payroll-ui/src/port';
import { requireOnline } from './offline-mutations';
import { payrollExportFileName, writeAndSharePayrollExport } from './payroll-export-io';
import { readCachedOr, toPayrollTimeEntry } from './payroll-repos';
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
      return readCachedOr('pr.admin.teamEntries', { orgId, from: range.from, to: range.to }, async () => {
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
      }, []);
    },

    async listSystemHours(range: PayrollDateRange): Promise<SystemHoursRow[]> {
      return readCachedOr('pr.admin.systemHours', { orgId, from: range.from, to: range.to }, async () => {
        // Pad a day each side for time zones, then keep segments whose local start date is in the range.
        const { data, error } = await supabase
          .from('job_time_segments')
          .select('tech_id, reason_code, started_at, ended_at')
          .eq('organization_id', orgId)
          .in('reason_code', ['job_labor', 'travel'])
          .not('ended_at', 'is', null)
          .gte('started_at', `${wageEngine.addDays(range.from, -1)}T00:00:00Z`)
          .lt('started_at', `${wageEngine.addDays(range.to, 2)}T00:00:00Z`);
        check(error);
        const byTech = new Map<string, SystemHoursRow>();
        for (const r of (data ?? []) as Row[]) {
          const start = new Date(r.started_at as string);
          const local = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
          if (local < range.from || local > range.to) continue;
          const ms = Date.parse(r.ended_at as string) - start.getTime();
          if (!Number.isFinite(ms) || ms <= 0) continue;
          let t = byTech.get(r.tech_id as string);
          if (!t) {
            t = { userId: r.tech_id as string, jobMin: 0, travelMin: 0 };
            byTech.set(t.userId, t);
          }
          if (r.reason_code === 'travel') t.travelMin += ms / 60000;
          else t.jobMin += ms / 60000;
        }
        return [...byTech.values()].map((t) => ({ ...t, jobMin: Math.round(t.jobMin), travelMin: Math.round(t.travelMin) }));
      }, []);
    },

    async approveWeek(forUserId, range) {
      requireOnline('approve this week');
      const { data, error } = await supabase.rpc('approve_timesheet', {
        p_user_id: forUserId,
        p_week_start: range.from,
        p_week_end: range.to,
      });
      check(error);
      if (data === 0) {
        throw new Error('Nothing was approved. Draft hours need migration 0131 pushed, or the week has no approvable entries.');
      }
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

    async closeRun(range, opts) {
      requireOnline('close the payroll run');
      const only = opts?.userIds ? new Set(opts.userIds) : null;
      if (only && only.size === 0) throw new Error('Pick at least one employee for the run.');
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
        if (only && !only.has(e.userId)) continue;
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
        if (only && !only.has(r.user_id)) continue;
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

      // Turn the canonical doc into the file QuickBooks reads and hand it to the admin.
      const start = exp.periodStart;
      const end = exp.periodEnd;
      if (format === 'generic_csv') {
        await writeAndSharePayrollExport(format, start, end, wageEngine.toGenericCsv(exp));
      } else if (format === 'iif_timeact') {
        await writeAndSharePayrollExport(format, start, end, wageEngine.toIifTimeact(exp));
      } else {
        const { data: acctData, error: aErr } = await supabase.from('payroll_qb_account_map').select('*').maybeSingle();
        check(aErr);
        const a = (acctData ?? {}) as Row;
        const accounts = {
          wages_expense: a.wages_expense ?? 'Payroll Expenses',
          reimbursement_expense: a.reimbursement_expense ?? 'Reimbursements',
          payroll_payable: a.payroll_payable ?? 'Payroll Liabilities',
        };
        if (format === 'iif_journal') {
          await writeAndSharePayrollExport(format, start, end, wageEngine.toIifGeneralJournal(exp, accounts));
        } else {
          const parts = wageEngine.toQboJournalCsv(exp, accounts);
          for (let i = 0; i < parts.length; i++) {
            const base = payrollExportFileName(format, start, end);
            const name = parts.length > 1 ? base.replace(/\.csv$/, `-part${i + 1}.csv`) : base;
            await writeAndSharePayrollExport(format, start, end, parts[i] ?? '', name);
          }
        }
      }
      return exp;
    },

    async listAllReimbursements(): Promise<AdminReimbursement[]> {
      return readCachedOr('pr.admin.reimbursements', {}, async () => {
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
      }, []);
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
