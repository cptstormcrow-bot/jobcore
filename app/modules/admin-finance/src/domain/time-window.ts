/**
 * Time-window overlap check (P3g.1).
 *
 * Pure `Date.getTime()` arithmetic, no new dependency. Feeds
 * `domain/assignment-warnings.ts`'s tech-schedule-overlap warning
 * (`03-P3-admin-finance.md` §4: "Warn ... on overlap with an existing
 * `scheduled_start`/`scheduled_end` for that tech").
 */

/** A half-open span, ISO-8601 timestamp strings (mirrors `Job.scheduledStart`/`scheduledEnd`). */
export interface TimeWindow {
  start: string;
  end: string;
}

/**
 * True iff `a` and `b` share any span of time. Comparison is half-open
 * (`aStart < bEnd && bStart < aEnd`) so two windows that only touch at an
 * endpoint — one job ending exactly when the next begins — do NOT overlap.
 */
export function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  const aStart = new Date(a.start).getTime();
  const aEnd = new Date(a.end).getTime();
  const bStart = new Date(b.start).getTime();
  const bEnd = new Date(b.end).getTime();
  return aStart < bEnd && bStart < aEnd;
}
