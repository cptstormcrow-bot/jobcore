/**
 * P3-c.3: derive billable hours from a job's `job_time_segments` rows.
 *
 * Hours are DERIVED from `TimeSegment` rows (job_time_segments), each
 * carrying a `reasonCode`, `startedAt`, and `endedAt`.
 * `hoursByReason` sums each reason's duration in hours, rounded to 0.01h.
 * A zero-segment job fails rather than silently deriving zero hours.
 */

import type { CalculationResult, TimeSegment, TimeSegmentReasonCode, BillableHours } from './types';

/**
 * The subset of `Job` this function actually reads. Declared locally (rather
 * than importing the full `Job` type from `packages/core`) so this pure
 * function's input surface is exactly what it uses — nothing more.
 */
export interface BillableHoursInput {
  segments: TimeSegment[];
}

/**
 * Turn a job's `TimeSegment` rows into billable hours by reason code.
 * Pure: no Date.now(), no clock read, no I/O — every input is a parameter.
 *
 * Policy:
 *   - Sum each segment's duration into `hoursByReason[seg.reasonCode]`.
 *   - Callers decide which reasons count toward paid hours (see rollup.ts).
 *     lunch/materials/other are bookkeeping-only, never paid.
 *   - A zero-segment job fails rather than silently deriving zero hours.
 */
export function deriveBillableHours(
  input: BillableHoursInput
): CalculationResult<BillableHours> {
  const { segments } = input;

  if (segments.length === 0) {
    return { ok: false, reason: 'no time segments for this job' };
  }

  const hoursByReason: Record<TimeSegmentReasonCode, number> = {
    job_labor: 0, lunch: 0, materials: 0, prem_visit: 0, travel: 0, other: 0,
  };
  for (const seg of segments) {
  if (seg.endedAt == null) {
    return { ok: false, reason: `seg ${seg.id} no endedAt` };
  }
  const startMs = Date.parse(seg.startedAt);
  const endMs = Date.parse(seg.endedAt);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return { ok: false, reason: `seg ${seg.id} bad timestamp` };
  }
  if (endMs < startMs) {
    return {
      ok: false,
      reason: `seg ${seg.id} endedAt before startedAt`,
    };
  }
  hoursByReason[seg.reasonCode] += (endMs - startMs) / 3600000;
  }

  // Round each reason to the nearest hundredth of an hour.
  const rounded: Record<TimeSegmentReasonCode, number> = {} as any;
  for (const k of Object.keys(hoursByReason) as TimeSegmentReasonCode[]) {
    rounded[k] = Math.round(hoursByReason[k] * 100) / 100;
  }
  return { ok: true, value: { hoursByReason: rounded } };
}
