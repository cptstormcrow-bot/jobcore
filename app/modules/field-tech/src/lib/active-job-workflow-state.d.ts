/**
 * Sync-readable workflow-state singleton for the field-tech module (P4.S1.4).
 *
 * `state-machine.ts`'s three preconditions (submitted start checklist for
 * `in_progress`, after-photos + quality notes for `completed`) are evaluated
 * via `Ctx` probes through `readSyncProbe`, which treats a returned Promise
 * as "not satisfied" (fail-closed — see plan gap notes). Those probes MUST
 * therefore be backed by a synchronous in-memory read, not a live DB query.
 *
 * This module is that in-memory backing store: a per-job record of whether
 * the start checklist has been submitted, whether at least one after-photo
 * has been recorded, and whether quality notes have been written. Screens
 * record progress here as it happens (`recordAfterPhoto`, etc.); the probe
 * functions handed into `Ctx` read this store synchronously.
 *
 * This is module-local state, not persisted data — it does not replace the
 * S1.1 repositories or S0.1 tables. It exists solely to give `Ctx`'s probes
 * something synchronous to read. State is per-job and keyed by `job.id`;
 * it is cleared explicitly (e.g. on job completion or sign-out) via
 * `clearJobWorkflowState`.
 */
export interface JobWorkflowState {
    startChecklistSubmitted: boolean;
    afterPhotoCount: number;
    hasQualityNotes: boolean;
}
/** Records that the start checklist has been submitted for `jobId`. */
export declare function recordStartChecklistSubmitted(jobId: string): void;
/** Records that an after-photo has been captured for `jobId`. */
export declare function recordAfterPhoto(jobId: string): void;
/** Records that quality notes have been written for `jobId`. */
export declare function recordQualityNotes(jobId: string): void;
/** Clears all recorded workflow state for `jobId` (e.g. on completion). */
export declare function clearJobWorkflowState(jobId: string): void;
/**
 * Synchronous probe: has `job`'s start checklist been submitted?
 * Suitable for direct assignment to `Ctx.hasSubmittedStartChecklist`.
 */
export declare function hasSubmittedStartChecklist(job: {
    id: string;
}): boolean;
/**
 * Synchronous probe: does `job` have at least one recorded after-photo?
 * Suitable for direct assignment to `Ctx.hasAfterPhotos`.
 */
export declare function hasAfterPhotos(job: {
    id: string;
}): boolean;
/**
 * Synchronous probe: have quality notes been recorded for `job`?
 * Suitable for direct assignment to `Ctx.hasQualityNotes`.
 */
export declare function hasQualityNotes(job: {
    id: string;
}): boolean;
//# sourceMappingURL=active-job-workflow-state.d.ts.map