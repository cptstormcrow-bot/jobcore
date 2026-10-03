/**
 * Pure helpers extracted from `DayList.tsx` so they can be exercised under
 * the plain-node assertion runner without pulling in `react-native` /
 * `@jobcore/ui` at runtime (Rule 41 fix, FC-09).
 */

import { addDays, isSameDay } from 'date-fns';
import type { Job } from '@jobcore/core';
import type { TimeOffEvent } from '@jobcore/ui';
import { isActiveTimeOffStatus, type TimeOffRequest } from '../data/ports';

/**
 * True when `job.scheduledStart` falls on the same LOCAL calendar date as
 * `today`. A job with no `scheduledStart` is never "today".
 */
export function isScheduledOnLocalDate(job: Job, today: Date): boolean {
  if (job.scheduledStart === null || job.scheduledStart === undefined) {
    return false;
  }
  const scheduled = new Date(job.scheduledStart);
  if (Number.isNaN(scheduled.getTime())) {
    return false;
  }
  return isSameDay(scheduled, today);
}

/** Job statuses that count as "closed out" — everything else counts as open. */
export const CLOSED_JOB_STATUSES: ReadonlySet<Job['status']> = new Set([
  'completed',
  'paid',
  'closed',
  'declined',
  'cancelled',
]);

/**
 * The open job with the earliest `scheduledStart` at or after 00:00 LOCAL of
 * `now`. Ties keep input order. `undefined` when nothing qualifies.
 */
export function pickNextJob(jobs: Job[], now: Date): Job | undefined {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let best: Job | undefined;
  let bestTime = Infinity;
  for (const job of jobs) {
    if (CLOSED_JOB_STATUSES.has(job.status)) continue;
    if (job.scheduledStart === null || job.scheduledStart === undefined) continue;
    const t = new Date(job.scheduledStart).getTime();
    if (Number.isNaN(t) || t < dayStart) continue;
    if (t < bestTime) {
      best = job;
      bestTime = t;
    }
  }
  return best;
}

/**
 * Finished jobs (`completed` | `paid` | `closed`), newest first by
 * `completedAt ?? scheduledStart`; jobs with neither go last. Input not mutated.
 */
export function listPreviousJobs(jobs: Job[], limit = 10): Job[] {
  const stamp = (job: Job): number => {
    const raw = job.completedAt ?? job.scheduledStart;
    if (raw === null || raw === undefined) return -Infinity;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  };
  return jobs
    .filter((job) => job.status === 'completed' || job.status === 'paid' || job.status === 'closed')
    .map((job, index) => ({ job, index, t: stamp(job) }))
    .sort((a, b) => (a.t === b.t ? a.index - b.index : a.t > b.t ? -1 : 1))
    .slice(0, limit)
    .map((entry) => entry.job);
}

/**
 * Expands each active (`pending` | `approved`) `TimeOffRequest` — spanning a
 * `startDate`/`endDate` range — into one `TimeOffEvent` per calendar day in
 * range. Mirrors `AdminFinanceRoot.toCalendarTimeOffEvents`, minus the
 * admin-only tech-name lookup (this list is always the signed-in tech's own
 * requests).
 */
export function expandTimeOffToEvents(requests: TimeOffRequest[], now: Date = new Date()): TimeOffEvent[] {
  const events: TimeOffEvent[] = [];
  for (const request of requests) {
    if (!isActiveTimeOffStatus(request.status)) continue;
    const start = parseCalendarDate(request.startDate);
    const end = parseCalendarDate(request.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }
    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      events.push({
        id: `${request.id}-${cursor.toISOString().slice(0, 10)}`,
        title: 'Day Off',
        description: request.reason,
        eventTime: cursor.toISOString(),
        techId: request.techId,
      });
      cursor = addDays(cursor, 1);
    }
  }
  return events;
}

function parseCalendarDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day);
}
