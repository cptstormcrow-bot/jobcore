import type { Job } from '@jobcore/core';
import type { JobEstimate, Payment, PaymentMethod, PaymentsRepository } from '../data/ports';
import { PAYMENT_METHODS } from '../data/ports';
import { balanceCents, canRecordPayment, invoiceTotalCents } from '../domain/payments';

/**
 * recordJobPayment: admin/owner records a payment against an approved estimate.
 * Money is integer cents internally; dollars only at the port call. Deliberately
 * does NOT call transitionJob() — the job status is left untouched.
 */
export interface RecordJobPaymentDeps {
  payments: PaymentsRepository;
}

export interface RecordJobPaymentInput {
  amountDollars: number;
  method: PaymentMethod;
}

export type RecordJobPaymentResult =
  | { ok: true; payment: Payment; balanceCents: number }
  | { ok: false; reason: string };

export async function recordJobPayment(
  role: string,
  orgId: string,
  job: Job,
  estimate: JobEstimate,
  payments: readonly Payment[],
  input: RecordJobPaymentInput,
  deps: RecordJobPaymentDeps
): Promise<RecordJobPaymentResult> {
  if (role !== 'admin' && role !== 'owner') {
    return { ok: false, reason: `recordJobPayment: role '${role}' may not record payments (admin or owner only)` };
  }
  if (!canRecordPayment(job, estimate)) {
    return { ok: false, reason: `recordJobPayment: job ${job.id} needs an approved estimate and must not be cancelled` };
  }
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) {
    return { ok: false, reason: `recordJobPayment: unknown payment method '${String(input.method)}'` };
  }
  if (!Number.isFinite(input.amountDollars) || input.amountDollars <= 0) {
    return { ok: false, reason: 'recordJobPayment: amount must be a number greater than zero' };
  }
  const amountCents = Math.round(input.amountDollars * 100);
  if (amountCents <= 0) {
    return { ok: false, reason: 'recordJobPayment: amount must be at least one cent' };
  }
  const balanceBefore = balanceCents(invoiceTotalCents(estimate), payments);
  if (amountCents > balanceBefore) {
    return { ok: false, reason: `recordJobPayment: amount ${amountCents} cents exceeds remaining balance ${balanceBefore} cents` };
  }
  const payment = await deps.payments.recordPayment(orgId, job.id, { amount: amountCents / 100, method: input.method });
  return { ok: true, payment, balanceCents: balanceBefore - amountCents };
}
