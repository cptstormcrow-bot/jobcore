/**
 * Pure type vocabulary for the admin-finance money core (P3-c.1).
 * No logic, no imports outside this file, no React, no Supabase.
 */

/** Integer cents. Never a float-of-dollars — all money math is integer-cent arithmetic. */
export type Money = number;

/**
 * Mirrors the `jobs.attach_timing` / `leads.attach_timing` columns
 * (supabase/0004_scheduling.sql L78, L97). NO CHECK constraint enumerates
 * allowed values there — both columns are plain `text` — so this is left as
 * `string` rather than a byte-matched union.
 */
export type AttachTiming = string;

/**
 * Mirrors the `publication_status` enum that P3-a.1 will create.
 */
export type PriceSheetStatus = 'draft' | 'published' | 'archived';

/** A versioned price sheet belonging to an organization. */
export interface PriceSheet {
  id: string;
  organizationId: string;
  version: number;
  status: PriceSheetStatus;
  publishedAt: string | null;
}

/** One rate row within a price sheet, keyed by service and attach timing. */
export interface PriceSheetRate {
  id: string;
  priceSheetId: string;
  serviceId: string;
  attachTiming: AttachTiming;
  amount: Money;
}

/** A tech's or sales rep's compensation configuration. */
export interface CompensationPolicy {
  id: string;
  organizationId: string;
  commissionBasisPercent: number;
  hourlyRate: Money;
}

/**
 * The return shape of `calculateCommission`. Snapshots both the price sheet
 * and compensation policy that produced it, so a later change to either
 * never retroactively alters a paid commission.
 *
 * HARD CONSTRAINT (AC-9): this type carries NO reimbursement-shaped field —
 * no `reimbursement`, no `expenses`, no `deduction`. A reimbursement is
 * NEVER a deduction against commission.
 */
export interface CommissionLine {
  jobId: string;
  priceSheetId: string;
  compensationPolicyId: string;
  amount: Money;
}

/** A span of time that is unpaid by construction — travel and idle time. */
export interface UnpaidSpan {
  from: string;
  to: string;
  reason: 'travel' | 'idle';
}

/** Billable hours for a period, net of any unpaid spans. */
export interface BillableHours {
  hours: number;
  unpaidSpans: UnpaidSpan[];
}

/** The result of evaluating one bonus rule. */
export interface BonusResult {
  amount: Money;
  rule: string;
  explanation: string;
}

/**
 * A pay-period breakdown, never a single number. Matches the DB check
 * `total_amount = hours_amount + commission_amount + bonus_amount +
 * reimbursement_amount`. `total` is DERIVED — the sum of the other four —
 * never an independently supplied value.
 */
export interface PeriodPayResult {
  hoursAmount: Money;
  commissionAmount: Money;
  bonusAmount: Money;
  reimbursementAmount: Money;
  /** DERIVED: hoursAmount + commissionAmount + bonusAmount + reimbursementAmount. */
  total: Money;
}

/** A failed calculation, carrying a human-readable reason string. */
export interface CalculationFailure {
  ok: false;
  reason: string;
}

/** A successful calculation, carrying its resulting value. */
export interface CalculationOk<T> {
  ok: true;
  value: T;
}

/**
 * The result of any money-core calculation that can be rejected — e.g.
 * `calculateCommission` rejecting an unpublished price sheet with a reason.
 */
export type CalculationResult<T> = CalculationOk<T> | CalculationFailure;
