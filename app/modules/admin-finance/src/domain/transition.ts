/**
 * Job transition seam (P3f.1, AC-4).
 *
 * `@jobcore/core`'s `applyTransition` is the ONLY legal way to change a
 * `Job.status` (`packages/core/src/state-machine.ts`'s single declarative
 * transition table). This file is admin-finance's SOLE call site of it —
 * nothing else under `modules/admin-finance/src` may import `applyTransition`
 * directly, enforced by the `no-restricted-imports` override in
 * `app/.eslintrc.cjs`. That keeps every job-status change in this module
 * flowing through one seam instead of scattered raw `status === '...'` logic.
 *
 * `transitionJob` is a thin pass-through — it adds no logic of its own. The
 * point is the import boundary, not a behavior change: callers elsewhere in
 * admin-finance ask `transitionJob`, never `applyTransition`.
 */

import type { Ctx, Job, JobStatus } from '@jobcore/core';
import { applyTransition } from '@jobcore/core';

/**
 * Advance `job` to `to`, applying the same role/precondition/audit rules as
 * `@jobcore/core`'s `applyTransition` (it rejects an illegal transition by
 * throwing with a human-readable reason — see `PreconditionResult`).
 */
export function transitionJob(job: Job, to: JobStatus, ctx: Ctx): Promise<Job> {
  return applyTransition(job, to, ctx);
}
