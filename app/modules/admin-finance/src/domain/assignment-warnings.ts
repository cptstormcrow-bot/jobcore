/**
 * Assignment-board warnings (P3g.2).
 *
 * `03-P3-admin-finance.md` §4 ("Assignment board and dispatch"):
 *   "Warn (do not hard-block) on overlap with an existing
 *   `scheduled_start`/`scheduled_end` for that tech, and on assignment
 *   outside a seeded `service_areas` community."
 *
 * `warningsFor` is pure — no DB, no network, no clock read — mirroring
 * `qualify.ts`'s style. It ALWAYS returns a list, never a boolean gate: the
 * assignment board's own architecture is warn-only, so nothing downstream
 * may treat this return value as a block condition (see `WarningSheet.tsx`,
 * whose confirm button stays enabled regardless of what this returns).
 *
 * `serviceAreaId` is a caller-supplied parameter, not read off `job` — same
 * reason `qualify.ts`'s `buildJobFromLead` takes it as a parameter:
 * `@jobcore/core`'s `Job` type deliberately does not declare
 * `serviceAreaId` (`supabase/0006_job_service_area.sql` added the column;
 * the shared `Job` type was not widened for it), so this module always
 * carries the value alongside the job rather than on it.
 */

import type { Job } from '@jobcore/core';
import { overlaps, type TimeWindow } from './time-window';

export type AssignmentWarningCode = 'tech_schedule_overlap' | 'missing_service_area';

export interface AssignmentWarning {
  code: AssignmentWarningCode;
  message: string;
}

/**
 * Warnings for assigning `job` to a tech who already has `techJobs` on
 * their board, in a job whose resolved service area is `serviceAreaId`
 * (`null` if the address did not resolve to a seeded `service_areas` row).
 *
 * - `tech_schedule_overlap`: `job`'s own `scheduledStart`/`scheduledEnd`
 *   overlaps (via `time-window.ts`'s `overlaps`) any OTHER job already on
 *   that tech's board with its own scheduled window. A job missing either
 *   scheduled timestamp cannot overlap anything and is skipped.
 * - `missing_service_area`: `serviceAreaId` is `null`.
 */
export function warningsFor(
  job: Job,
  techJobs: Job[],
  serviceAreaId: string | null,
): AssignmentWarning[] {
  const warnings: AssignmentWarning[] = [];

  if (job.scheduledStart && job.scheduledEnd) {
    const window: TimeWindow = { start: job.scheduledStart, end: job.scheduledEnd };
    const hasOverlap = techJobs.some((other) => {
      if (other.id === job.id) return false;
      if (!other.scheduledStart || !other.scheduledEnd) return false;
      return overlaps(window, { start: other.scheduledStart, end: other.scheduledEnd });
    });
    if (hasOverlap) {
      warnings.push({
        code: 'tech_schedule_overlap',
        message: 'This tech already has a job scheduled during this window.',
      });
    }
  }

  if (serviceAreaId === null) {
    warnings.push({
      code: 'missing_service_area',
      message: 'This job is outside a known service area.',
    });
  }

  return warnings;
}
