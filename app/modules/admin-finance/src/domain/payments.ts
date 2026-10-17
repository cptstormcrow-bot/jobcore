/**
 * Invoice / payment balance helpers. Pure functions; the domain works in
 * integer cents.
 *
 * Unit note: `JobEstimate.totalCost` and `Payment.amount` are both dollars
 * (`numeric(10,2)` in `0036_job_estimates.sql` / `0010_payment_review.sql`),
 * so each is converted with `Math.round(x * 100)` to avoid float drift.
 */

import type { Job } from '@jobcore/core';
import type { JobEstimate, Payment } from '../data/ports';
import { SETTLED_PAYMENT_STATUSES } from '../data/ports';

/** Approved estimate total in integer cents (`totalCost` is dollars). */
export function invoiceTotalCents(estimate: JobEstimate): number {
  return Math.round(estimate.totalCost * 100);
}

/** Sum of settled payments (`SETTLED_PAYMENT_STATUSES`) in integer cents. */
export function settledTotalCents(payments: readonly Payment[]): number {
  return payments
    .filter((p) => SETTLED_PAYMENT_STATUSES.includes(p.status))
    .reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
}

/** Raw difference, invoice minus settled; may go negative (overpayment). */
export function balanceCents(invoiceCents: number, payments: readonly Payment[]): number {
  return invoiceCents - settledTotalCents(payments);
}

/** A payment may be recorded only against an approved estimate on a non-cancelled job. */
export function canRecordPayment(job: Job, estimate: JobEstimate): boolean {
  return estimate.status === 'approved' && job.status !== 'cancelled';
}
