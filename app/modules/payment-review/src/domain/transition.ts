/**
 * payment-review's sole call site for the shared state machine's
 * applyTransition. Structurally identical to field-tech's
 * `domain/transition.ts` (S2 scaffolding) — see that file's header for the
 * full rationale.
 *
 * This file is deliberately thin: it forwards to `@jobcore/core`'s
 * `canTransition`/`applyTransition` with proper typing and does NOT
 * reimplement any precondition logic. The `hasPaymentRecord` probe is NOT
 * wired to a real payment-record lookup in this slice — that lands in S4.
 * `buildTransitionCtx` here is a placeholder scaffold mirroring field-tech's
 * shape, not new logic.
 *
 * `packages/core/src/data/ports.ts` does not exist yet, so this function
 * takes an already-assembled `Ctx` as a parameter rather than constructing
 * one itself — assembling `ctx` (wiring the precondition probes to real data
 * access) is the caller's responsibility until the data-access layer lands.
 */

import type { Ctx, Job, JobStatus } from '@jobcore/core';
import { applyTransition, canTransition } from '@jobcore/core';

/**
 * Checks whether `job` may transition to `to` under `ctx` without applying
 * the transition. Thin pass-through to the core's `canTransition`.
 */
export function canTransitionJob(job: Job, to: JobStatus, ctx: Ctx) {
  return canTransition(job, to, ctx);
}

/**
 * Applies a job status transition. Thin pass-through to the core's
 * `applyTransition` — see the file header for what this does and does not
 * do. Rejects with the core's exact reason string on an illegal transition.
 */
export function transitionJob(job: Job, to: JobStatus, ctx: Ctx): Promise<Job> {
  return applyTransition(job, to, ctx);
}
