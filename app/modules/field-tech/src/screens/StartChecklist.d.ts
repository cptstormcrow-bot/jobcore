/**
 * StartChecklist screen for the field-tech module (P4 Wave 3 slice S3.4).
 *
 * Covers the on-my-way / start / submit arc of a tech's day:
 * - On-my-way: `transitionJob(job, 'en_route', ctx)` — this module's sole
 *   call site for status transitions (see `domain/transition.ts`; never
 *   import `applyTransition` directly from `@jobcore/core`, enforced by the
 *   field-tech `.eslintrc.cjs` override).
 * - Start: instantiates a `checklist_instance` of kind `'start'` via
 *   `ChecklistRepository.createInstance`, pinning the template's CURRENT
 *   `version` at instantiation time (`ChecklistTemplate.version`), then lets
 *   the tech capture before-photos. Each before-photo is recorded through the
 *   offline mutation primitives in `@jobcore/core`'s `offline/queue`
 *   (`makeIdempotencyKey`, `NewQueuedMutation`) — mirroring the shape
 *   `offline/apply.ts`'s `applyOptimistic` uses for transitions — before the
 *   photo row is persisted via `JobPhotoRepository.create`. When the caller
 *   supplies no `enqueuePhotoMutation` sink the mutation is still computed
 *   (so the idempotency key exists) but nothing is queued, matching
 *   `applyOptimistic`'s "optional injected seam" precedent.
 * - Submit: submits the checklist instance's item answers via
 *   `ChecklistRepository.submitInstance`, THEN records the submission in the
 *   S1.4 sync-readable singleton (`recordStartChecklistSubmitted`) so
 *   `Ctx.hasSubmittedStartChecklist` reads synchronously true, THEN calls
 *   `transitionJob(job, 'in_progress', ctx)` — matching the plan's ordering
 *   ("submit → set S1.4 singleton then transitionJob(...,'in_progress',...)").
 *
 * Ties to spec AC5, VS2/3.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile` — mirrors the layering of
 * `modules/admin-finance/src/{index.ts,data/ports.ts,lib/module-session.ts}`.
 *
 * ZERO financial fields. This screen must never render or read anything
 * sourced from `price_sheets`, commissions, or payout data.
 */
import type { Job } from '@jobcore/core';
import type { NewQueuedMutation } from '@jobcore/core';
export interface StartChecklistProps {
    /** The job the tech is starting work on. */
    job: Job;
    /**
     * Optional offline-queue sink for before-photo mutations, shaped like
     * `OptimisticApplyOptions.enqueue` in `@jobcore/core`'s `offline/apply.ts`.
     * When absent, the mutation is still computed but nothing is persisted to
     * a queue and nothing throws.
     */
    enqueuePhotoMutation?: (mutation: NewQueuedMutation) => void | Promise<void>;
    /** Called after the `in_progress` transition succeeds. */
    onDone: () => void;
}
/**
 * StartChecklist screen: on-my-way transition, start-checklist instantiation
 * with before-photo capture via the offline queue, and submit (checklist
 * submit + S1.4 singleton + `in_progress` transition).
 */
export declare function StartChecklist({ job, enqueuePhotoMutation, onDone }: StartChecklistProps): JSX.Element;
//# sourceMappingURL=StartChecklist.d.ts.map