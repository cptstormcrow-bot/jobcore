/**
 * Data seam for payout batches (P3k.2b).
 *
 * Interfaces only for the read side, plus a mapper and a persist-write port
 * for the write side — NO Supabase implementation lives here, matching
 * `reimbursement-repo.ts` (P3k.2a) and `price-sheet-repo.ts`'s
 * `SupabaseRpcClient`-minimal-client discipline. Distinct from `ports.ts`
 * (P3d.1): that file has no payout-batch port at all yet, so this module
 * owns the row types, the row→domain mapper, and the repo port for payout
 * batches specifically.
 *
 * This repo persists and reads the `PayoutBatch` / `FrozenPayoutLine` domain
 * types that `buildPayoutBatch` (`../money/payout-batch.ts`, P3k.1) produces
 * — it does not redefine them, only maps them to/from the Supabase row shape.
 *
 * Field naming mirrors `payout_batches` / `payout_lines` (P3a.4,
 * `app/supabase/0005_money.sql:188-224`): all amount columns are integer
 * cents (`Money`, `../money/types.ts`), matching `payout-batch.ts`'s
 * `FrozenPayoutLine` discipline.
 */

import type { CalculationResult } from '../money/types';
import type { PayoutBatch, FrozenPayoutLine } from '../money/payout-batch';

/* ------------------------------------------------------------------ *
 * payout_batches / payout_lines rows (snake_case) → domain type (camelCase)
 * ------------------------------------------------------------------ */

/** Mirrors the Supabase `payout_batches` table (`app/supabase/0005_money.sql` L188-206). */
export interface PayoutBatchRow {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
}

/**
 * Mirrors the Supabase `payout_lines` table (`app/supabase/0005_money.sql`
 * L207-224). All amount columns are integer cents, matching
 * `payout-batch.ts`'s `FrozenPayoutLine.hoursAmount` etc.
 */
export interface PayoutLineRow {
  id: string;
  batch_id: string;
  user_id: string;
  hours_amount_cents: number;
  commission_amount_cents: number;
  bonus_amount_cents: number;
  reimbursement_amount_cents: number;
  total_amount_cents: number;
  frozen_at: string;
  source_hash: string;
}

/**
 * Map a `payout_lines` row to the domain `FrozenPayoutLine`. No validation
 * branch is needed here (unlike `reimbursement-repo.ts`'s `toReimbursement`)
 * because a payout line row carries no enum-typed column.
 */
export function toFrozenPayoutLine(row: PayoutLineRow): FrozenPayoutLine {
  return {
    userId: row.user_id,
    hoursAmount: row.hours_amount_cents,
    commissionAmount: row.commission_amount_cents,
    bonusAmount: row.bonus_amount_cents,
    reimbursementAmount: row.reimbursement_amount_cents,
    totalAmount: row.total_amount_cents,
    frozenAt: row.frozen_at,
    sourceHash: row.source_hash,
  };
}

/**
 * Map a `payout_batches` row plus its already-fetched `payout_lines` rows to
 * the domain `PayoutBatch` (`../money/payout-batch.ts`). `lineRows` is
 * supplied separately rather than joined inline — matching the two-table
 * shape of `payout_batches` / `payout_lines` — and mapped via
 * `toFrozenPayoutLine` per row.
 */
export function toPayoutBatch(row: PayoutBatchRow, lineRows: PayoutLineRow[]): PayoutBatch {
  return {
    id: row.id,
    organizationId: row.organization_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    lines: lineRows.map(toFrozenPayoutLine),
  };
}

/* ------------------------------------------------------------------ *
 * Repository port
 * ------------------------------------------------------------------ */

/**
 * Read/persist access to payout batches. Distinct from `ports.ts`'s (P3d.1)
 * port list, which declares no payout-batch port at all.
 */
export interface PayoutBatchRepo {
  /** All payout batches for the organization, newest period first. */
  listForOrganization(organizationId: string): Promise<PayoutBatch[]>;

  /** A single payout batch by id, or `null` if it doesn't exist. */
  getById(batchId: string): Promise<PayoutBatch | null>;

  /**
   * Marks a batch approved (`status` transitions to `'approved'` per the
   * Supabase `payout_batch_status` enum, `app/supabase/0005_money.sql`).
   * Mirrors `ReimbursementRepo.approve`'s shape so `PayoutBatchScreen.tsx`
   * can follow the same per-row approve pattern as
   * `ReimbursementQueueScreen.tsx`.
   */
  approve(batchId: string): Promise<CalculationResult<PayoutBatch>>;

  /**
   * Marks a batch paid (`status` transitions to `'paid'` per the Supabase
   * `payout_batch_status` enum, `app/supabase/0005_money.sql`). Mirrors
   * `approve`'s shape so `PayoutBatchScreen.tsx` can follow the same
   * per-row mark-paid pattern as the approve action.
   */
  markPaid(batchId: string): Promise<CalculationResult<PayoutBatch>>;

  /**
   * Persists a newly built `PayoutBatch` (`buildPayoutBatch`,
   * `../money/payout-batch.ts`, P3k.1) — the batch and every one of its
   * already-frozen lines, unchanged, as a single write. The concrete
   * `persistPayoutBatchViaRpc` below is the RPC-backed implementation; a
   * `PayoutBatchRepo` adapter wires this method to that function.
   */
  persist(batch: PayoutBatch): Promise<CalculationResult<PayoutBatch>>;
}

/* ------------------------------------------------------------------ *
 * Supabase RPC implementations
 * ------------------------------------------------------------------ */

/**
 * Minimal shape of the Supabase client surface this file depends on — just
 * `rpc`, not the full `SupabaseClient` type, matching `reimbursement-repo.ts`'s
 * and `price-sheet-repo.ts`'s `SupabaseRpcClient` so this module stays free
 * of a hard `@supabase/supabase-js` import.
 */
export interface SupabaseRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Shape an RPC returning a full batch-plus-lines payload is expected to hand
 * back — a `payout_batches` row plus its `payout_lines` rows — so
 * `persistPayoutBatchViaRpc` can map the response through `toPayoutBatch`
 * without a second round trip.
 */
export interface PayoutBatchWithLinesRow {
  batch: PayoutBatchRow;
  lines: PayoutLineRow[];
}

/**
 * Persists `batch` by invoking a `create_payout_batch` RPC with the batch's
 * organization/period fields and its lines. DECLARED-ONLY here (matching
 * `reimbursement-repo.ts`'s `approveReimbursementViaRpc` shape) — the RPC
 * itself does not exist yet; this function is the interface a future
 * migration's RPC wires up to, per this slice's scope note (interfaces/pure
 * mapping only, no live Supabase).
 */
export async function persistPayoutBatchViaRpc(
  client: SupabaseRpcClient,
  batch: PayoutBatch,
): Promise<CalculationResult<PayoutBatch>> {
  const { data, error } = await client.rpc('create_payout_batch', {
    p_organization_id: batch.organizationId,
    p_period_start: batch.periodStart,
    p_period_end: batch.periodEnd,
    p_lines: batch.lines.map((line) => ({
      user_id: line.userId,
      hours_amount_cents: line.hoursAmount,
      commission_amount_cents: line.commissionAmount,
      bonus_amount_cents: line.bonusAmount,
      reimbursement_amount_cents: line.reimbursementAmount,
      total_amount_cents: line.totalAmount,
      frozen_at: line.frozenAt,
      source_hash: line.sourceHash,
    })),
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  const payload = data as PayoutBatchWithLinesRow;
  return { ok: true, value: toPayoutBatch(payload.batch, payload.lines) };
}
