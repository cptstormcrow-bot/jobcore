import type { IsoDate, RateChange } from './types.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hourly rate (cents) in force on `date`: the change with the LATEST effectiveFrom
 * that is <= date. A change takes effect ON its effectiveFrom date (inclusive), so the
 * day before it still uses the previous rate.
 *
 * Returns null when the history is empty OR `date` is earlier than every effectiveFrom.
 * null means "no rate in force": the caller must decide what to do, because silently
 * defaulting a payroll rate is unsafe.
 *
 * Input may be unsorted and is never mutated (a copy is sorted). If two entries share
 * the same effectiveFrom, the later entry in input order wins.
 *
 * Throws RangeError for a malformed date (format check only, no calendar validation).
 */
export function rateOnDate(history: readonly RateChange[], date: IsoDate): number | null {
  if (!DATE_RE.test(date)) throw new RangeError(`Invalid ISO date: ${date}`);
  let best: RateChange | null = null;
  for (const change of history) {
    if (change.effectiveFrom > date) continue;
    // >= so a later input entry wins a tie on effectiveFrom.
    if (best === null || change.effectiveFrom >= best.effectiveFrom) best = change;
  }
  return best === null ? null : best.hourlyRateCents;
}
