/**
 * Completion screen for the field-tech module (P4 Wave 3 slice S3.5).
 *
 * Completion checklist + at least one after-photo + quality notes, then
 * `transitionJob(job, 'completed', ctx)` — this module's sole call site for
 * status transitions (see `domain/transition.ts`; never import
 * `applyTransition` directly from `@jobcore/core`, enforced by the
 * field-tech `.eslintrc.cjs` override).
 *
 * `ctx.hasAfterPhotos`/`ctx.hasQualityNotes` passed to `transitionJob` are
 * plain synchronous closures over this screen's own local state, read fresh
 * (`lib/active-job-workflow-state.ts`, S1.4) are called BEFORE
 * `transitionJob(...)` so that `ctx.hasAfterPhotos`/`ctx.hasQualityNotes`
 * read synchronously true when `canTransition`/`applyTransition` evaluate
 * the `completed` precondition in `packages/core/src/state-machine.ts`. The
 * quality-notes `job_notes` row (kind='quality_notes') is written first,
 * then `recordQualityNotes`/`recordAfterPhoto` update the in-memory probe
 * store, then `transitionJob` runs.
 *
 * Ties to spec AC3, AC5, VS2.
 *
 * ZERO financial fields — this screen never renders anything sourced from
 * `price_sheets`, commissions, or payout data.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile`.
 */
import type { Job } from '@jobcore/core';
export interface CompletionProps {
    /** The job being completed. */
    job: Job;
    /** Called after the job has successfully transitioned to `completed`. */
    onDone: () => void;
}
/**
 * Completion screen: checklist + after-photo + quality notes, then
 * transitions the job to `completed`. Requires at least one after-photo
 * and non-empty quality notes client-side before enabling submit — this is
 * a UX guard only; the real gate is the core `completed` precondition.
 */
export declare function Completion({ job, onDone }: CompletionProps): JSX.Element;
//# sourceMappingURL=Completion.d.ts.map