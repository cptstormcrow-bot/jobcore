/**
 * Data seam for reimbursement approve/reject (P3k.2a).
 *
 * Interfaces only for the read side, plus pure request-shaping helpers for
 * the write side — NO Supabase implementation lives here, matching
 * `price-sheet-repo.ts`'s `SupabaseRpcClient`-minimal-client discipline.
 * Distinct from `ports.ts` (P3d.1): that file has no reimbursement port at
 * all yet, so this module owns the row type, the row→domain mapper, and the
 * repo port for reimbursements specifically.
 *
 * SPEC: a reimbursement is never a deduction against commission
 * (`app/supabase/0005_money.sql` L166-167) — this file adds no field or
 * function that links a reimbursement to a `CommissionLine`.
 */

import type { CalculationResult } from '../money/types';
import { requireOnline } from '../lib/online';

/* ------------------------------------------------------------------ *
 * reimbursements row (snake_case) → domain type (camelCase)
 * ------------------------------------------------------------------ */

/** Mirrors the `reimbursement_status` enum (`app/supabase/0005_money.sql` L20-25). */
export type ReimbursementStatus = 'pending' | 'approved' | 'rejected' | 'paid';

const REIMBURSEMENT_STATUSES: readonly ReimbursementStatus[] = [
  'pending',
  'approved',
  'rejected',
  'paid',
];

function isReimbursementStatus(value: string): value is ReimbursementStatus {
  return (REIMBURSEMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Mirrors the Supabase `reimbursements` table (`app/supabase/0005_money.sql`
 * L168-181). `status` is left `string`, not `ReimbursementStatus` — it is
 * untrusted wire data until `toReimbursement` validates it, matching
 * `price-sheet-repo.ts`'s `PriceSheetRow.status` discipline.
 */
export interface ReimbursementRow {
  id: string;
  organization_id: string;
  user_id: string;
  job_id: string | null;
  amount_cents: number;
  description: string | null;
  receipt_photo_path: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Domain shape of a reimbursement request. `amount` is integer cents
 * (`Money`, `../money/types.ts`) — never a float-of-dollars.
 */
export interface Reimbursement {
  id: string;
  organizationId: string;
  userId: string;
  jobId: string | null;
  amount: number;
  description: string | null;
  receiptPhotoPath: string | null;
  status: ReimbursementStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Map a `reimbursements` row to the domain `Reimbursement`. Throws on an
 * unrecognized status rather than widening the union, matching
 * `price-sheet-repo.ts`'s `toPriceSheet` / `ports.ts`'s `toJob` discipline.
 */
export function toReimbursement(row: ReimbursementRow): Reimbursement {
  if (!isReimbursementStatus(row.status)) {
    throw new Error(`Unknown reimbursement status "${row.status}" on reimbursement ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    jobId: row.job_id,
    amount: row.amount_cents,
    description: row.description,
    receiptPhotoPath: row.receipt_photo_path,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------------------------------------------------------------ *
 * Approve / reject request shapes
 * ------------------------------------------------------------------ */

/** Input to an approve decision. */
export interface ApproveReimbursementInput {
  reimbursementId: string;
  approvedBy: string;
}

/**
 * Input to a reject decision. `reason` is REQUIRED — a reject without a
 * reason must not type-check as valid. This is the reject-path guard the
 * ledger row (P3k.2a) calls for.
 */
export interface RejectReimbursementInput {
  reimbursementId: string;
  approvedBy: string;
  reason: string;
}

/**
 * Validates a reject request has a non-empty `reason` before it is ever
 * sent to a repo write. Belt-and-suspenders alongside the type-level
 * requirement on `RejectReimbursementInput.reason` — a caller can still
 * construct one at runtime with an empty string, which this rejects.
 * Returns a `CalculationResult<void>` rather than throwing, matching
 * `price-sheet-repo.ts`'s `applyPublishPlanViaRpc` failable-write pattern.
 */
export function validateRejectReason(input: RejectReimbursementInput): CalculationResult<void> {
  if (input.reason.trim().length === 0) {
    return { ok: false, reason: 'A reject decision requires a non-empty reason.' };
  }
  return { ok: true, value: undefined };
}

/* ------------------------------------------------------------------ *
 * Repository port
 * ------------------------------------------------------------------ */

/**
 * Approve/reject access to reimbursements. Distinct from `ports.ts`'s
 * (P3d.1) port list, which declares no reimbursement port at all.
 */
export interface ReimbursementRepo {
  /** All reimbursements for the organization, in any status. */
  listForOrganization(organizationId: string): Promise<Reimbursement[]>;

  /** A single reimbursement by id, or `null` if it doesn't exist. */
  getById(reimbursementId: string): Promise<Reimbursement | null>;

  /**
   * Approves a pending reimbursement. The concrete `approveReimbursementViaRpc`
   * below is the RPC-backed implementation; a `ReimbursementRepo` adapter
   * wires this method to that function.
   */
  approve(input: ApproveReimbursementInput): Promise<CalculationResult<Reimbursement>>;

  /**
   * Rejects a pending reimbursement. `input.reason` is required
   * (`RejectReimbursementInput`, `validateRejectReason`) — a reject without
   * a reason returns a `CalculationResult` failure, never a silent no-op.
   */
  reject(input: RejectReimbursementInput): Promise<CalculationResult<Reimbursement>>;

  /** Marks an approved reimbursement as paid (`mark_reimbursement_paid`, 0082). */
  markPaid(reimbursementId: string): Promise<CalculationResult<Reimbursement>>;
}

/* ------------------------------------------------------------------ *
 * Supabase RPC implementations
 * ------------------------------------------------------------------ */

/**
 * Minimal shape of the Supabase client surface this file depends on — just
 * `rpc`, not the full `SupabaseClient` type, matching `price-sheet-repo.ts`'s
 * `SupabaseRpcClient` so this module stays free of a hard
 * `@supabase/supabase-js` import.
 */
export interface SupabaseRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Approves a pending reimbursement by invoking an `approve_reimbursement`
 * RPC. DECLARED-ONLY here (matching `price-sheet-repo.ts`'s
 * `applyPublishPlanViaRpc` shape) — the RPC itself does not exist yet; this
 * function is the interface a future migration's RPC wires up to, per this
 * slice's scope note (interfaces/pure mapping only, no live Supabase).
 */
export async function approveReimbursementViaRpc(
  client: SupabaseRpcClient,
  input: ApproveReimbursementInput,
): Promise<CalculationResult<Reimbursement>> {
  requireOnline('Approving a reimbursement');
  const { data, error } = await client.rpc('approve_reimbursement', {
    p_reimbursement_id: input.reimbursementId,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toReimbursement(data as ReimbursementRow) };
}

/**
 * Rejects a pending reimbursement by invoking a `reject_reimbursement` RPC.
 * Validates `input.reason` via `validateRejectReason` BEFORE calling the
 * RPC — a reject without a reason never reaches the network. DECLARED-ONLY
 * for the RPC call itself, matching `approveReimbursementViaRpc` above.
 */
export async function rejectReimbursementViaRpc(
  client: SupabaseRpcClient,
  input: RejectReimbursementInput,
): Promise<CalculationResult<Reimbursement>> {
  const reasonCheck = validateRejectReason(input);
  if (!reasonCheck.ok) {
    return reasonCheck;
  }
  requireOnline('Rejecting a reimbursement');
  const { data, error } = await client.rpc('reject_reimbursement', {
    p_reimbursement_id: input.reimbursementId,
    p_approved_by: input.approvedBy,
    p_reason: input.reason,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toReimbursement(data as ReimbursementRow) };
}

/**
 * Marks an approved reimbursement as paid via the `mark_reimbursement_paid`
 * RPC (migration 0082), which takes only the reimbursement id.
 */
export async function markReimbursementPaidViaRpc(
  client: SupabaseRpcClient,
  reimbursementId: string,
): Promise<CalculationResult<Reimbursement>> {
  requireOnline('Marking a reimbursement paid');
  const { data, error } = await client.rpc('mark_reimbursement_paid', {
    p_reimbursement_id: reimbursementId,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toReimbursement(data as ReimbursementRow) };
}
