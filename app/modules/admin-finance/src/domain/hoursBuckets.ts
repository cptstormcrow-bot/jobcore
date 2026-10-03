/**
 * hoursBuckets — sums worked hours into week / month / year buckets.
 *
 * Pure: no I/O. `now` is injected for testability. Semantics: only CLOSED
 * entries count (clockOutAt non-null and duration > 0); each entry is bucketed
 * by its clockInAt in LOCAL time; week starts Sunday. Each boundary is tested
 * independently against clockInAt (no bucket is derived from another). Returns
 * raw, unrounded hours — rounding is the UI's job.
 */

import { startOfMonth, startOfWeek, startOfYear } from 'date-fns';

/** Structural subset of data/ports `TimeEntry` (domain files never import data/). */
export interface HoursEntry {
  clockInAt: string;
  clockOutAt: string | null;
}

export function bucketHours(
  entries: HoursEntry[],
  now: Date,
): { week: number; month: number; year: number } {
  const weekStart = startOfWeek(now, { weekStartsOn: 0 }).getTime();
  const monthStart = startOfMonth(now).getTime();
  const yearStart = startOfYear(now).getTime();
  const out = { week: 0, month: 0, year: 0 };
  for (const entry of entries) {
    if (!entry.clockOutAt) continue;
    const inMs = new Date(entry.clockInAt).getTime();
    const durationMs = new Date(entry.clockOutAt).getTime() - inMs;
    if (!(durationMs > 0)) continue;
    const hours = durationMs / 3_600_000;
    if (inMs >= weekStart) out.week += hours;
    if (inMs >= monthStart) out.month += hours;
    if (inMs >= yearStart) out.year += hours;
  }
  return out;
}
