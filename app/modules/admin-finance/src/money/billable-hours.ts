/**
 * P3-c.3: derive billable hours from a job's payroll-grade timestamps.
 *
 * There is no clock-in/clock-out input in this system (BINDING CONSTRAINT 3) —
 * hours are DERIVED from the `jobs` table's own status timestamps
 * (supabase/0004_scheduling.sql L104-106): `en_route_at`, `in_progress_at`,
 * `completed_at`. This file consumes the camelCase mirrors of those columns
 * from `packages/core`'s `Job` type: `enRouteAt`, `inProgressAt`, `completedAt`.
 *
 * TIMESTAMP_FIELDS used for the billable window: enRouteAt -> completedAt
 * (the full dispatch-to-finish span), with `inProgressAt` as the interior
 * boundary that splits that span into an unpaid travel leg and a billable
 * work leg.
 */

import type { CalculationResult, UnpaidSpan, BillableHours } from './types';

/**
 * The subset of `Job` this function actually reads. Declared locally (rather
 * than importing the full `Job` type from `packages/core`) so this pure
 * function's input surface is exactly what it uses — nothing more.
 */
export interface BillableHoursInput {
  enRouteAt: string | null;
  inProgressAt: string | null;
  completedAt: string | null;
}

/**
 * Turn a job's payroll-grade timestamps into billable hours plus an explicit
 * list of unpaid spans. Pure: no Date.now(), no clock read, no I/O — every
 * input is a parameter (AC-8).
 *
 * Policy (travel and idle time are unpaid BY CONSTRUCTION):
 *   - The billable window is `enRouteAt` -> `completedAt`.
 *   - If `inProgressAt` is present inside that window, the window splits into
 *     two legs: `enRouteAt` -> `inProgressAt` is TRAVEL (unpaid, always emitted
 *     as an `UnpaidSpan`), and `inProgressAt` -> `completedAt` is the billable
 *     work leg.
 *   - If `inProgressAt` is absent, there is no data distinguishing travel from
 *     work inside the window, so the DECISION here is: treat the entire
 *     `enRouteAt` -> `completedAt` span as unpaid travel and bill zero hours.
 *     This is a deliberate policy choice (not an error) — a job that skipped
 *     `in_progress` is documented as "all travel, no billable leg" rather than
 *     silently guessed at.
 *   - A job that never went en_route is a FAILURE, not "0 billable hours" —
 *     it never entered the payroll-relevant window at all, so there is nothing
 *     to derive from and the caller must be told why.
 */
export function deriveBillableHours(
  input: BillableHoursInput
): CalculationResult<BillableHours> {
  const { enRouteAt, inProgressAt, completedAt } = input;

  if (enRouteAt == null) {
    return { ok: false, reason: 'job has no enRouteAt timestamp — never went en route' };
  }
  if (completedAt == null) {
    return { ok: false, reason: 'job has no completedAt timestamp — not yet completed' };
  }

  const enRouteMs = Date.parse(enRouteAt);
  const completedMs = Date.parse(completedAt);

  if (Number.isNaN(enRouteMs)) {
    return { ok: false, reason: `enRouteAt is not a parseable timestamp: ${enRouteAt}` };
  }
  if (Number.isNaN(completedMs)) {
    return { ok: false, reason: `completedAt is not a parseable timestamp: ${completedAt}` };
  }
  if (completedMs < enRouteMs) {
    return {
      ok: false,
      reason: 'completedAt is before enRouteAt — out-of-order timestamps',
    };
  }

  const unpaidSpans: UnpaidSpan[] = [];
  let billableMs: number;

  if (inProgressAt == null) {
    // No interior boundary: the whole en-route-to-completed span is unpaid
    // travel by policy (see doc comment above), zero billable hours.
    unpaidSpans.push({ from: enRouteAt, to: completedAt, reason: 'travel' });
    billableMs = 0;
  } else {
    const inProgressMs = Date.parse(inProgressAt);
    if (Number.isNaN(inProgressMs)) {
      return { ok: false, reason: `inProgressAt is not a parseable timestamp: ${inProgressAt}` };
    }
    if (inProgressMs < enRouteMs || inProgressMs > completedMs) {
      return {
        ok: false,
        reason: 'inProgressAt is not between enRouteAt and completedAt — out-of-order timestamps',
      };
    }

    unpaidSpans.push({ from: enRouteAt, to: inProgressAt, reason: 'travel' });
    billableMs = completedMs - inProgressMs;
  }

  const rawHours = billableMs / (1000 * 60 * 60);
  // Rounding rule: round to the nearest hundredth of an hour (2 decimal
  // places, i.e. nearest 36 seconds) — matches money-core's cent-level
  // precision expectation without introducing a third rounding convention.
  const hours = Math.round(rawHours * 100) / 100;

  return { ok: true, value: { hours, unpaidSpans } };
}
