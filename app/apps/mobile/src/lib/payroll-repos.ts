// Self-service payroll repo (PayrollSelfPort). Reads go through the offline read cache
// (time entries use the query name 'pr.time' so queued ops patch them); writes go through writeThrough.
import type { SupabaseClient } from '@supabase/supabase-js';
import { captureRecordEditBase, type wageEngine } from '@jobcore/core';
import type {
  PayrollSelfPort,
  PayrollTimeEntry,
  PayrollDateRange,
  PayrollSettings,
  PayrollReimbursement,
  NewReimbursementInput,
} from '../../../../packages/payroll-ui/src/port';
import { OfflineError, writeThrough } from './offline-mutations';
import { isOnlineNow } from './sync-events';
import { orWhenOffline } from './offline-fallback';
import { cachedRead, getReadCacheIdentity, buildReadCacheKey } from './read-cache';
import { getCached, listMeta } from './read-cache-store';
import { readEmployeeProfiles } from './employee-profiles-source';
import { clockDraftsFromSegments, type ClockSegmentRow } from './clock-entries';

type Row = Record<string, any>;

export interface PayrollRepoSession {
  orgId: string;
  userId: string;
}

// The fetch TypeError, raw or wrapped by a repo ("listForOrganization failed: TypeError: Network request failed").
function isNetworkFailure(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /Network request failed|Failed to fetch|TypeError: (Network|fetch)/i.test(msg);
}

// Offline with nothing saved yet: say so plainly instead of surfacing the raw fetch TypeError.
export async function readCached<T>(queryName: string, params: Record<string, unknown>, fetchLive: () => Promise<T>): Promise<T> {
  try {
    const id = getReadCacheIdentity();
    if (!id) return await fetchLive();
    const key = buildReadCacheKey(id.orgId, id.userId, queryName, params);
    const { data } = await cachedRead(key, fetchLive);
    return data;
  } catch (e) {
    if (!isOnlineNow() || isNetworkFailure(e)) throw new OfflineError('Not saved on this device yet. Open this once while online.');
    throw e;
  }
}

/** Like readCached, but an offline miss gives `empty` (a blank form) instead of an error. */
export async function readCachedOr<T>(queryName: string, params: Record<string, unknown>, fetchLive: () => Promise<T>, empty: T): Promise<T> {
  return orWhenOffline(() => readCached(queryName, params, fetchLive), empty, (e) => e instanceof OfflineError);
}

// Offline miss on a new date range (Hours keys on today, so its key changes daily):
// rebuild the range from every saved pr.time range instead of showing an error.
async function savedTimeRows(range: PayrollDateRange): Promise<PayrollTimeEntry[] | null> {
  const id = getReadCacheIdentity();
  if (!id) return null;
  const byId = new Map<string, PayrollTimeEntry>();
  for (const m of await listMeta(id.userId)) {
    if (m.query !== 'pr.time') continue;
    const row = await getCached(m.key);
    if (!row || row.orgId !== id.orgId) continue;
    let rows: unknown;
    try { rows = JSON.parse(row.payload); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const e of rows as PayrollTimeEntry[]) {
      if (e && e.id && e.workDate >= range.from && e.workDate <= range.to) byId.set(e.id, e);
    }
  }
  if (byId.size === 0) return null;
  return [...byId.values()].sort((a, b) => a.workDate.localeCompare(b.workDate));
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
    ...((r.bonus_amount ?? 0) > 0 ? { bonusCents: r.bonus_amount as number } : {}),
    totalCents: r.total_amount ?? 0,
  };
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function extOf(uri: string): string {
  const m = /\.([A-Za-z0-9]+)(?:\?.*)?$/.exec(uri);
  return m?.[1] ? m[1].toLowerCase() : 'jpg';
}

export function createPayrollRepos(supabase: SupabaseClient, session: PayrollRepoSession): PayrollSelfPort {
  const { orgId, userId } = session;

  // What this device last saw per time entry, so a queued edit can carry its base
  // (record-edit-guard): live rows keep updated_at, cached rows are values only.
  const TIME_COLS = ['work_date', 'minutes', 'clock_in_at', 'clock_out_at', 'source', 'notes'] as const;
  const known = new Map<string, { row: Row; updatedAt?: string }>();
  const remember = (e: PayrollTimeEntry) => {
    if (known.has(e.id)) return;
    known.set(e.id, {
      row: { work_date: e.workDate, minutes: e.minutes, clock_in_at: e.clockInAt, clock_out_at: e.clockOutAt, source: e.source, notes: e.notes },
    });
  };

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
        for (const r of (data ?? []) as Row[]) known.set(r.id, { row: r, updatedAt: r.updated_at ?? undefined });
        return ((data ?? []) as Row[]).map(toPayrollTimeEntry);
      })
        .catch(async (e) => {
          const saved = e instanceof OfflineError ? await savedTimeRows(range) : null;
          if (saved) return saved;
          throw e;
        })
        .then((rows) => {
          rows.forEach(remember);
          return rows;
        });
    },

    async upsertEntry(entry) {
      const occurredAt = new Date().toISOString();
      const seen = known.get(entry.id);
      const base = seen ? captureRecordEditBase(seen.row, TIME_COLS, seen.updatedAt) : undefined;
      await writeThrough(
        'payroll_time.upsert',
        {
          base,
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
      // A second offline edit is based on this one, not on the server row.
      known.set(entry.id, {
        row: { work_date: entry.workDate, minutes: entry.minutes, clock_in_at: entry.clockInAt, clock_out_at: entry.clockOutAt, source: entry.source, notes: entry.notes ?? null },
      });
    },

    async importClockEntries(range: PayrollDateRange) {
      // Online only: the segments and the "already imported" check both need the server.
      if (!isOnlineNow()) return 0;
      const { data: prof } = await readEmployeeProfiles((source) =>
        supabase.from(source).select('worker_type').eq('id', userId).maybeSingle(),
      );
      // Contractors are paid by payout, not by the hour.
      if ((prof as Row | null)?.worker_type === 'contractor') return 0;
      const { data: segs, error } = await supabase
        .from('job_time_segments')
        .select('id, reason_code, started_at, ended_at, jobs(job_number)')
        .eq('organization_id', orgId)
        .eq('tech_id', userId)
        .in('reason_code', ['job_labor', 'travel'])
        .not('ended_at', 'is', null)
        .gte('started_at', `${shiftDay(range.from, -1)}T00:00:00Z`)
        .lt('started_at', `${shiftDay(range.to, 2)}T00:00:00Z`);
      check(error);
      const rows = (segs ?? []) as unknown as ClockSegmentRow[];
      if (rows.length === 0) return 0;
      const { data: have, error: haveErr } = await supabase
        .from('payroll_time_entries')
        .select('id')
        .in('id', rows.map((r) => r.id));
      check(haveErr);
      const existing = new Set(((have ?? []) as Row[]).map((r) => r.id as string));
      const drafts = clockDraftsFromSegments(rows, existing, range);
      for (const d of drafts) {
        await this.upsertEntry({
          id: d.id,
          userId,
          workDate: d.workDate as wageEngine.IsoDate,
          minutes: d.minutes,
          clockInAt: d.clockInAt,
          clockOutAt: d.clockOutAt,
          source: 'clock',
          status: 'draft',
          notes: d.notes,
          rejectionReason: null,
        });
      }
      return drafts.length;
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
      return readCachedOr('pr.rateHistory', { uid }, async () => {
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
        // Fallback: roster column profiles.hourly_rate_cents (Employee editor), read through
        // employee_profiles_v so it survives the 0111 pay-column lock on the table.
        const { data: prof, error: profErr } = await readEmployeeProfiles((source) =>
          supabase.from(source).select('hourly_rate_cents').eq('id', uid).maybeSingle(),
        );
        if (profErr) return rows;
        const cents = (prof as Row | null)?.hourly_rate_cents;
        if (typeof cents === 'number' && cents > 0) {
          return [{ effectiveFrom: '1970-01-01' as wageEngine.IsoDate, hourlyRateCents: cents }];
        }
        return rows;
      }, []);
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
      return readCachedOr('pr.runLines', { from: range.from, to: range.to }, async () => {
        const { data, error } = await supabase
          .from('payout_lines')
          .select('*, payout_batches!inner(period_start, period_end)')
          .eq('user_id', userId)
          .gte('payout_batches.period_start', range.from)
          .lte('payout_batches.period_end', range.to);
        check(error);
        return ((data ?? []) as Row[]).map((r) => toRunLine(r, ''));
      }, []);
    },

    async listMyJobPay(range) {
      return readCachedOr('pr.jobPay', { from: range.from, to: range.to }, async () => {
        const { data, error } = await supabase
          .from('job_payout_lines')
          .select('id, basis, amount_cents, status, created_at, jobs(job_number)')
          .eq('user_id', userId)
          .neq('status', 'void')
          .gte('created_at', `${range.from}T00:00:00`)
          .lte('created_at', `${range.to}T23:59:59.999`)
          .order('created_at', { ascending: true });
        check(error);
        return ((data ?? []) as Row[]).map((r) => ({
          id: r.id as string,
          jobNumber: ((r.jobs as Row | null)?.job_number as number | null) ?? null,
          basis: r.basis as string,
          amountCents: r.amount_cents as number,
          status: r.status as 'pending' | 'included',
          createdAt: r.created_at as string,
        }));
      }, []);
    },

    async listMyReimbursements() {
      return readCachedOr('pr.reimbursements', {}, async () => {
        const { data, error } = await supabase
          .from('reimbursements')
          .select('id, user_id, amount_cents, description, job_id, receipt_photo_path, status, rejection_reason, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        check(error);
        return ((data ?? []) as Row[]).map(toReimbursement);
      }, []);
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
