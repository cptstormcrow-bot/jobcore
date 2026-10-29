// Sales-marketing replay handlers. Pure network functions: no SQLite, no React.
// Errors are never wrapped: the drain classifier reads .code/.status/.message.
import { registerOpHandlers, type OpHandler } from './index';

export interface SalesCallbackMarkPayload {
  jobId: string;
  organizationId: string;
  calledBackBy: string;
  calledBackAt: string;
}

// Upsert on the job_id key: replaying twice leaves one row with the same values (idempotent).
const salesCallbackMarkCalledBack: OpHandler<SalesCallbackMarkPayload> = async (p, ctx) => {
  const { error } = await ctx.supabase.from('sales_callback_status').upsert(
    {
      job_id: p.jobId,
      organization_id: p.organizationId,
      called_back_at: p.calledBackAt,
      called_back_by: p.calledBackBy,
    },
    { onConflict: 'job_id' },
  );
  if (error) throw error;
  return { applied: true } as const;
};

export const SALES_OP_HANDLERS: Record<string, OpHandler<any>> = {
  'sales_callback.mark_called_back': salesCallbackMarkCalledBack,
};

registerOpHandlers(SALES_OP_HANDLERS);
