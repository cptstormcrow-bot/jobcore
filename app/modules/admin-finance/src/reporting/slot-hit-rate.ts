/**
 * Pure slot-hit-rate reporting helper (P3l.2).
 *
 * Classifies each job's `requestedWindow` (nullable free text, DB column
 * `requested_window`, mapped through `../data/ports.ts`'s `toJob`) as a
 * hit, a miss, or unknown. `requestedWindow` is untyped text with no
 * guaranteed format — an unparseable or null value counts as `'unknown'`,
 * NEVER as a hit or a miss. This mirrors the honest-unknown discipline in
 * `group-by.ts`'s `bySource`/`byAttachTiming`.
 *
 * A job is classified as a "hit" when `requestedWindow` is present and,
 * per business rule, the job's actual scheduled/completed time falls
 * within that requested window; "miss" when present but outside it;
 * "unknown" when `requestedWindow` is null, empty, or not parseable as a
 * recognizable window expression.
 *
 * Comparison field: `Job` (`@jobcore/core`) carries `scheduledStart` /
 * `scheduledEnd` (the business commitment, `0004_scheduling.sql`) as the
 * fields conceptually distinct from `requestedWindow` (the customer's ask)
 * — the type's own doc-comment calls out that collapsing the two "destroys
 * slot-hit reporting" (Master Spec §6.3), which is exactly this report.
 * `scheduledStart` is therefore used as the comparison field: a job's
 * scheduled start hour is checked for falling inside the requested window.
 *
 * KNOWN LIMITATION: there is no existing parser for `requestedWindow`'s
 * free-text format anywhere in this codebase (checked `../data/ports.ts`
 * and this `reporting/` directory — neither defines one). `classifyWindow`
 * below therefore recognizes only one narrow, explicit format:
 * `"HH:MM-HH:MM"` in 24-hour time (e.g. `"09:00-12:00"`). Any other text
 * — AM/PM notation, day names, ranges spanning midnight, garbage, etc. —
 * is honestly reported as `'unknown'` rather than guessed at. Widening
 * this format table is a follow-up, not something to invent here.
 */

import type { Job } from '@jobcore/core';

const WINDOW_PATTERN = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;

/**
 * Classifies a single job's slot outcome. Returns `'unknown'` whenever
 * either `requestedWindow` is missing/unparseable, or the comparison field
 * (`scheduledStart`) is unavailable — hit/miss is only ever returned when
 * both are present and requestedWindow matches the recognized format.
 */
export function classifyWindow(job: Job): 'hit' | 'miss' | 'unknown' {
  const window = job.requestedWindow;
  if (!window) {
    return 'unknown';
  }

  const match = WINDOW_PATTERN.exec(window);
  if (!match) {
    return 'unknown';
  }

  if (!job.scheduledStart) {
    return 'unknown';
  }

  const scheduled = new Date(job.scheduledStart);
  if (Number.isNaN(scheduled.getTime())) {
    return 'unknown';
  }

  const [, startH, startM, endH, endM] = match;
  const startMinutes = Number(startH) * 60 + Number(startM);
  const endMinutes = Number(endH) * 60 + Number(endM);
  const scheduledMinutes = scheduled.getUTCHours() * 60 + scheduled.getUTCMinutes();

  return scheduledMinutes >= startMinutes && scheduledMinutes <= endMinutes ? 'hit' : 'miss';
}

export interface SlotHitRateResult {
  hit: number;
  miss: number;
  unknown: number;
  total: number;
  hitRate: number; // hit / (hit + miss), 0 when hit+miss === 0 -- unknowns excluded from the denominator
}

/** Aggregates `classifyWindow` over a job set into hit/miss/unknown tallies and a hit rate. */
export function slotHitRate(jobs: readonly Job[]): SlotHitRateResult {
  let hit = 0;
  let miss = 0;
  let unknown = 0;

  for (const job of jobs) {
    const outcome = classifyWindow(job);
    if (outcome === 'hit') {
      hit += 1;
    } else if (outcome === 'miss') {
      miss += 1;
    } else {
      unknown += 1;
    }
  }

  const denominator = hit + miss;
  return {
    hit,
    miss,
    unknown,
    total: jobs.length,
    hitRate: denominator === 0 ? 0 : hit / denominator,
  };
}
