import { rateOnDate } from './rates.js';
import type { DayAllocation, RateChange, RateSegment, RunLine } from './types.js';

function requireNonNegInt(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a non-negative integer, got ${value}`);
  }
}

/**
 * Wages in cents for a run line: rate x (reg + 1.5*ot + 2*dt) / 60, summed over every
 * segment and rounded ONCE (half up). Pure integer arithmetic: halfUnits is
 * rate x (2*reg + 3*ot + 4*dt), so the cents are floor((halfUnits + 60) / 120).
 *
 * Throws RangeError for a negative or non-integer rate or minute count, or a sum that
 * is not a safe integer. An empty list is 0.
 */
export function grossCentsForSegments(segments: RateSegment[]): number {
  let halfUnits = 0;
  for (const s of segments) {
    requireNonNegInt(s.hourlyRateCents, 'hourlyRateCents');
    requireNonNegInt(s.regularMin, 'regularMin');
    requireNonNegInt(s.otMin, 'otMin');
    requireNonNegInt(s.dtMin, 'dtMin');
    halfUnits += s.hourlyRateCents * (2 * s.regularMin + 3 * s.otMin + 4 * s.dtMin);
    if (!Number.isSafeInteger(halfUnits)) {
      throw new RangeError('wage total exceeds the safe integer range');
    }
  }
  return Math.floor((halfUnits + 60) / 120);
}

/**
 * Group day allocations into rate segments. Days are taken in ascending workDate order
 * (a copy is sorted; the input is never mutated). Days at the same rate merge into one
 * segment even when not contiguous; segment order is first appearance. A day with no
 * rate in force uses `fallbackRateCents` when given, else throws RangeError naming the
 * date. All-zero days add nothing and a segment with no minutes is not emitted.
 */
export function segmentsFromDays(
  days: DayAllocation[],
  history: RateChange[],
  fallbackRateCents?: number,
): RateSegment[] {
  const sorted = [...days].sort((a, b) =>
    a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : 0,
  );
  const byRate = new Map<number, RateSegment>();
  for (const day of sorted) {
    let rate = rateOnDate(history, day.workDate);
    if (rate === null) {
      if (fallbackRateCents === undefined) {
        throw new RangeError(`no hourly rate in force on ${day.workDate}`);
      }
      rate = fallbackRateCents;
    }
    let seg = byRate.get(rate);
    if (seg === undefined) {
      seg = { hourlyRateCents: rate, regularMin: 0, otMin: 0, dtMin: 0 };
      byRate.set(rate, seg);
    }
    seg.regularMin += day.regularMin;
    seg.otMin += day.otMin;
    seg.dtMin += day.dtMin;
  }
  return [...byRate.values()].filter((s) => s.regularMin + s.otMin + s.dtMin > 0);
}

export interface BuildRunLineInput {
  userId: string;
  employeeName: string;
  days: DayAllocation[];
  rateHistory: RateChange[];
  reimbursementCents?: number;
  fallbackRateCents?: number;
}

/** Build one employee's run line: segments, minute totals, gross (rounded once) and total. */
export function buildRunLine(input: BuildRunLineInput): RunLine {
  const reimbursementCents = input.reimbursementCents ?? 0;
  requireNonNegInt(reimbursementCents, 'reimbursementCents');
  const segments = segmentsFromDays(input.days, input.rateHistory, input.fallbackRateCents);
  let regularMin = 0;
  let otMin = 0;
  let dtMin = 0;
  for (const s of segments) {
    regularMin += s.regularMin;
    otMin += s.otMin;
    dtMin += s.dtMin;
  }
  const grossCents = grossCentsForSegments(segments);
  return {
    userId: input.userId,
    employeeName: input.employeeName,
    regularMin,
    otMin,
    dtMin,
    segments,
    grossCents,
    reimbursementCents,
    totalCents: grossCents + reimbursementCents,
  };
}
