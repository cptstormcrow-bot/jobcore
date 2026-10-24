/**
 * Close-out queue selection and blocker surfacing (P3h.1a, P3h.1b).
 *
 * The close-out flow drives a job through `completed -> paid -> closed`
 * (`state-machine.ts:127-138`). A job is "awaiting close-out" once field
 * work has produced a `completed` job and until it reaches `closed` — the
 * two in-between statuses (`completed`, `paid`) are the ones the queue
 * screen (P3h.2) must surface. Membership is decided by `Set.has()`, never
 * a raw `status === '...'` comparison (AC-4 mechanism).
 *
 * `closeOutBlockers` asks `@jobcore/core`'s `canTransition` directly — there
 * is no domain-layer wrapper for it, unlike `applyTransition` (see
 * `domain/transition.ts`). It surfaces `canTransition`'s `reason` string
 * verbatim: no rewording, no wrapping, no prettifying.
 */

import type { Ctx, Job, JobStatus } from '@jobcore/core';
import { canTransition } from '@jobcore/core';

/**
 * Statuses a job sits in while awaiting close-out, restated as a runtime
 * `Set` so membership is tested with `.has()` rather than a `status === '...'`
 * comparison (mirrors the `JOB_STATUSES` tuple idiom in `data/ports.ts:52-66`).
 */
const AWAITING_CLOSE_OUT_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>([
  'completed',
  'paid',
]);

/**
 * True when `job` is awaiting close-out — `completed` or `paid`, not yet
 * `closed`. Membership test only; never a `status === '...'` comparison.
 */
export function awaitingCloseOut(job: Job): boolean {
  return AWAITING_CLOSE_OUT_STATUSES.has(job.status);
}

export type CloseOutStatus = 'unassigned' | 'in_progress' | 'completed';

const IN_PROGRESS: ReadonlySet<JobStatus> = new Set(['assigned', 'accepted', 'en_route', 'in_progress']);
const COMPLETED: ReadonlySet<JobStatus> = new Set(['completed', 'paid', 'closed']);

export function closeOutStatus(job: Job): CloseOutStatus {
  if (COMPLETED.has(job.status)) return 'completed';
  if (IN_PROGRESS.has(job.status)) return 'in_progress';
  return 'unassigned';
}

/**
 * The next close-out edge per awaiting-close-out status — `completed ->
 * paid`, `paid -> closed`. A lookup table, not a `status === '...'` branch.
 */
const NEXT_CLOSE_OUT_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  completed: 'paid',
  paid: 'closed',
};

/** The status `job` advances to at close-out, or null when it has no next edge. */
export function nextCloseOutStatus(job: Pick<Job, 'status'>): JobStatus | null {
  return NEXT_CLOSE_OUT_STATUS[job.status] ?? null;
}

/**
 * Reasons `job` cannot advance to its next close-out status right now,
 * asking `canTransition` directly (P3h.1a's sole sanctioned exception to the
 * `applyTransition`-only import boundary — `canTransition` performs no
 * write). Empty when the job is free to advance. The reason string is
 * `canTransition`'s own, verbatim — never reworded, wrapped, or prettified.
 */
export function closeOutBlockers(job: Job, ctx: Ctx): string[] {
  if (!awaitingCloseOut(job)) {
    return [];
  }
  const next = NEXT_CLOSE_OUT_STATUS[job.status];
  if (next === undefined) {
    return [];
  }
  const result = canTransition(job, next, ctx);
  if (result.ok) {
    return [];
  }
  return [result.reason];
}
