// Payroll time-entry replay handlers. Pure network functions: no SQLite, no React.
// Errors are never wrapped: the drain classifier reads .code/.status/.message.
import { registerOpHandlers, type OpHandler } from './index';

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

export const PAYROLL_OP_HANDLERS: Record<string, OpHandler<any>> = {
  'payroll_time.upsert': payrollTimeUpsert,
  'payroll_time.delete': payrollTimeDelete,
  'payroll_timesheet.submit': payrollTimesheetSubmit,
};

registerOpHandlers(PAYROLL_OP_HANDLERS);
