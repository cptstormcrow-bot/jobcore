/**
 * Greeting screen for the field-tech module (P4 Wave 3 slice S3.1).
 *
 * Shown to a tech for a newly assigned job, offering accept/decline.
 * - Decline requires a non-empty reason: writes a `job_notes` row
 *   (kind='decline_reason', body=<reason>) via this module's `notes` port,
 *   THEN calls `transitionJob(job, 'declined', ctx)` — this module's sole
 *   call site for status transitions (see `domain/transition.ts`; never
 *   import `applyTransition` directly from `@jobcore/core`, enforced by the
 *   field-tech `.eslintrc.cjs` override).
 * - Accept is a passive acknowledgement only: per the plan, "silence leaves
 *   status untouched", so accept dismisses the greeting and proceeds onward
 *   without calling `transitionJob` or inventing a transition.
 *
 * Ties to spec AC2, VS1.
 *
 * Field-tech isolation: this screen reads session/ports via
 * `lib/module-session.ts` (S1.2) and `lib/module-ports.ts` (S1.3) rather
 * than importing anything from `apps/mobile` — mirrors the layering of
 * `modules/admin-finance/src/{index.ts,data/ports.ts,lib/module-session.ts}`.
 */
import type { Job } from '@jobcore/core';
export interface GreetingProps {
    /** The job the tech has been assigned and is being greeted for. */
    job: Job;
    /** Called after the tech accepts (passive — no status mutation) or after a decline transition succeeds. */
    onDone: () => void;
}
/**
 * Greeting screen: accept (passive, dismiss-only) or decline (requires a
 * non-empty reason, writes a job_notes row, then transitions the job).
 */
export declare function Greeting({ job, onDone }: GreetingProps): JSX.Element;
//# sourceMappingURL=Greeting.d.ts.map