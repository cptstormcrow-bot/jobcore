/**
 * Data seam for the payment-review module (P5.S4).
 *
 * Interfaces + one query function only, mirroring
 * `modules/field-tech/src/data/ports.ts`'s discipline (row shape, a
 * status-validating mapper, no live Supabase client construction here) and
 * `modules/admin-finance/src/data/reimbursement-repo.ts`'s minimal-client
 * pattern (a narrow `SupabaseSelectClient` surface, not the full
 * `@supabase/supabase-js` `SupabaseClient` type).
 *
 * Row shape mirrors `app/supabase/0010_payment_review.sql`'s `payments`
 * table (L32-45) field-for-field.
 */

/** Mirrors the `payments_status_check` constraint (0010_payment_review.sql L43-44). */
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'manual_confirmed';

const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'confirmed',
  'failed',
  'manual_confirmed',
];

function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/** Statuses that satisfy `requirePaymentSettled`'s "a payment record exists" precondition (P2b.2 / P5 AC 1-2). */
const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = ['confirmed', 'manual_confirmed'];

/** Mirrors the `payments` table. `status` is `string` — untrusted wire data until validated against `PaymentStatus`. */
export interface PaymentRow {
  id: string;
  organization_id: string;
  job_id: string;
  provider_id: string;
  amount: number;
  status: string;
  external_ref: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
}

/**
 * Minimal shape of the Supabase client surface this file depends on — just
 * enough of the `from().select().eq().in()` / `from().select().in()` chains
 * to run both queries this module needs, matching `reimbursement-repo.ts`'s
 * `SupabaseRpcClient` minimal-surface discipline so this module stays free
 * of a hard `@supabase/supabase-js` import.
 *
 * `PaymentFilterChain` is a flat (non-recursive) shape shared by both call
 * sites: `hasSettledPaymentForJob` calls `.eq(...).in(...)` (filters by one
 * job), while `ReconciliationView` calls `.select(...).in(...)` directly
 * (filters across all jobs by status). Exposing `in()` directly from
 * `select()` — in addition to `eq()` — lets ONE type satisfy both call
 * shapes without widening to the full `@supabase/supabase-js` generic
 * client type.
 */
type PaymentQueryResult = PromiseLike<{ data: PaymentRow[] | null; error: { message: string } | null }>;

interface PaymentFilterChain {
  in(column: string, values: readonly string[]): PaymentQueryResult;
}

export interface SupabaseSelectClient {
  from(table: string): {
    select(columns: string): PaymentFilterChain & {
      eq(column: string, value: string): PaymentFilterChain;
    };
  };
}

/**
 * The real `hasPaymentRecord` probe (P5.S4). Queries `payments` for rows on
 * `jobId` whose `status` is one of `SETTLED_PAYMENT_STATUSES`
 * (`'confirmed'` or `'manual_confirmed'`) — a `'pending'` or `'failed'` row
 * does NOT satisfy the precondition. Untrusted `status` values that fail
 * `isPaymentStatus` are dropped rather than counted, matching this
 * module-family's fail-closed row-mapper discipline (`toJob`,
 * `toReimbursement`, etc.) even though no domain object is constructed here.
 *
 * Does NOT apply the `payer !== 'customer'` exemption — callers own that
 * check. Async: resolves `true` when at least one settled row exists, and
 * `false` on a query error or null data (fail closed).
 */
export async function hasSettledPaymentForJob(
  client: SupabaseSelectClient,
  jobId: string,
): Promise<boolean> {
  const { data, error } = await client.from('payments').select('*').eq('job_id', jobId).in(
    'status',
    SETTLED_PAYMENT_STATUSES,
  );
  if (error || data === null) {
    return false;
  }
  return data.some((row) => isPaymentStatus(row.status) && SETTLED_PAYMENT_STATUSES.includes(row.status));
}
