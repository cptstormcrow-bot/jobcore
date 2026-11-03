// Payroll time-entry replay handlers. Pure network functions: no SQLite, no React.
// Errors are never wrapped: the drain classifier reads .code/.status/.message.
import { PAYROLL_TIME_EDIT_POLICY, type RecordEditBase } from '@jobcore/core';
import { registerOpHandlers, type OpHandler } from './index';
import { updateRecordGuarded } from './record-edit-guard';

const APPLIED = { applied: true } as const;

function check(error: { message?: string } | null): void {
  if (error) throw error;
}

export interface PayrollTimeUpsertPayload {
  id: string;
  userId: string;
  workDate: string;
  minutes: number;
  clockInAt: string | null;
  clockOutAt: string | null;
  source: 'manual' | 'clock';
  notes: string | null;
  /** Seen values (+ updated_at) when an existing entry was edited; absent for new entries and old queued rows. */
  base?: RecordEditBase;
}
export interface PayrollTimeDeletePayload {
  id: string;
}
export interface PayrollTimesheetSubmitPayload {
  weekStart: string;
  weekEnd: string;
}

// Upsert keyed on the client-minted pkey so a clock-out replay updates the clock-in row.
// status is deliberately omitted: new rows default to 'draft' and an existing row keeps its
// status. A row that is no longer draft/rejected fails RLS (42501) and is thrown raw for the classifier.
const payrollTimeUpsert: OpHandler<PayrollTimeUpsertPayload> = async (p, ctx) => {
  if (p.base) {
    // Edit of an existing entry: guarded update (falls back to a plain update if the row is not visible).
    await updateRecordGuarded(
      ctx,
      'payroll_time_entries',
      p.id,
      {
        work_date: p.workDate,
        minutes: p.minutes,
        clock_in_at: p.clockInAt,
        clock_out_at: p.clockOutAt,
        source: p.source,
        notes: p.notes ?? null,
      },
      p.base,
      PAYROLL_TIME_EDIT_POLICY,
      { versionCol: 'updated_at', record: 'time entry' },
    );
    return APPLIED;
  }
  const { error } = await ctx.supabase.from('payroll_time_entries').upsert(
    {
      id: p.id,
      organization_id: ctx.orgId,
      user_id: p.userId,
      work_date: p.workDate,
      minutes: p.minutes,
      clock_in_at: p.clockInAt,
      clock_out_at: p.clockOutAt,
      source: p.source,
      notes: p.notes ?? null,
    },
    { onConflict: 'id' },
  );
  // 23505 on the primary key is an idempotent replay.
  if (error && (error as { code?: string }).code === '23505') return APPLIED;
  check(error);
  return APPLIED;
};

// Zero rows affected is not an error: the row is already gone.
const payrollTimeDelete: OpHandler<PayrollTimeDeletePayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('payroll_time_entries').delete().eq('id', p.id);
  check(error);
  return APPLIED;
};

// submit_timesheet(p_week_start, p_week_end) only updates draft/rejected rows, so a replay is a no-op.
const payrollTimesheetSubmit: OpHandler<PayrollTimesheetSubmitPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.rpc('submit_timesheet', {
    p_week_start: p.weekStart,
    p_week_end: p.weekEnd,
  });
  check(error);
  return APPLIED;
};

export type PayrollTimesheetWithdrawPayload = PayrollTimesheetSubmitPayload;

const payrollTimesheetWithdraw: OpHandler<PayrollTimesheetWithdrawPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.rpc('withdraw_timesheet', {
    p_week_start: p.weekStart,
    p_week_end: p.weekEnd,
  });
  check(error);
  return APPLIED;
};

export const PAYROLL_OP_HANDLERS: Record<string, OpHandler<any>> = {
  'payroll_time.upsert': payrollTimeUpsert,
  'payroll_time.delete': payrollTimeDelete,
  'payroll_timesheet.submit': payrollTimesheetSubmit,
  'payroll_timesheet.withdraw': payrollTimesheetWithdraw,
};

registerOpHandlers(PAYROLL_OP_HANDLERS);
