/**
 * Field-tech's sole call site for the shared state machine's applyTransition.
 * Never call applyTransition directly elsewhere in field-tech — see
 * .eslintrc.cjs field-tech override (S0.4).
 *
 * This file is deliberately thin: it forwards to `@jobcore/core`'s
 * `canTransition`/`applyTransition` with proper typing and does NOT
 * reimplement any precondition logic. The three named preconditions
 * (submitted start checklist for `in_progress`, after-photo + quality notes
 * for `completed`, payment record or non-customer payer for `paid`) live in
 * `packages/core/src/state-machine.ts` and are evaluated there via the
 * `Ctx` probes (`hasSubmittedStartChecklist`, `hasAfterPhotos`,
 * `hasQualityNotes`, `hasPaymentRecord`).
 *
 * `packages/core/src/data/ports.ts` (S1.1) does not exist yet, so this
 * function takes an already-assembled `Ctx` as a parameter rather than
 * constructing one itself — assembling `ctx` (wiring the precondition
 * probes to real data access) is the caller's responsibility until the
 * data-access layer lands.
 */
import { applyTransition, canTransition } from '@jobcore/core';
/**
 * Checks whether `job` may transition to `to` under `ctx` without applying
 * the transition. Thin pass-through to the core's `canTransition`.
 */
export function canTransitionJob(job, to, ctx) {
    return canTransition(job, to, ctx);
}
/**
 * Applies a job status transition. Thin pass-through to the core's
 * `applyTransition` — see the file header for what this does and does not
 * do. Rejects with the core's exact reason string on an illegal transition.
 */
export function transitionJob(job, to, ctx) {
    return applyTransition(job, to, ctx);
}
