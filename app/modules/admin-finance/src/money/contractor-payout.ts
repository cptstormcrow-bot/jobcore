/**
 * Contractor payout domain logic for the Close-Outs feature (Slice 6).
 *
 * Mirrors the Supabase `contractor_payouts` table (supabase/migrations/0054_contractor_payout.sql).
 * TS uses camelCase; the DB is snake_case — a mapping layer at the repo boundary bridges them.
 */

export type ContractorPayoutStatus = 'pending' | 'approved' | 'paid';

export interface ContractorPayout {
  id: string;
  organizationId: string;
  jobId: string;
  techId: string;
  amountCents: number;
  status: ContractorPayoutStatus;
  createdAt: string;
  paidAt: string | null;
}

/**
 * Constructs a new pending contractor payout for a closed-out job. Amount is
 * expressed in integer cents to avoid floating-point drift in money math.
 */
export function createPendingPayout(params: {
  organizationId: string;
  jobId: string;
  techId: string;
  amountCents: number;
}): Omit<ContractorPayout, 'id' | 'createdAt'> {
  if (params.amountCents < 0) {
    throw new Error('createPendingPayout: amountCents must be >= 0');
  }
  return {
    organizationId: params.organizationId,
    jobId: params.jobId,
    techId: params.techId,
    amountCents: params.amountCents,
    status: 'pending',
    paidAt: null,
  };
}

/** Legal status transitions for a contractor payout: pending -> approved -> paid. */
const PAYOUT_TRANSITIONS: Record<ContractorPayoutStatus, ContractorPayoutStatus[]> = {
  pending: ['approved'],
  approved: ['paid'],
  paid: [],
};

export function canTransitionPayout(
  from: ContractorPayoutStatus,
  to: ContractorPayoutStatus
): boolean {
  return PAYOUT_TRANSITIONS[from].includes(to);
}
