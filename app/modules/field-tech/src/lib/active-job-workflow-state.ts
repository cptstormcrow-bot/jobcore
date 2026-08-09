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

const EMPTY_STATE: JobWorkflowState = {
  startChecklistSubmitted: false,
  afterPhotoCount: 0,
  hasQualityNotes: false,
};

const stateByJobId = new Map<string, JobWorkflowState>();

function getOrCreate(jobId: string): JobWorkflowState {
  let existing = stateByJobId.get(jobId);
  if (!existing) {
    existing = { ...EMPTY_STATE };
    stateByJobId.set(jobId, existing);
  }
  return existing;
}

/** Records that the start checklist has been submitted for `jobId`. */
export function recordStartChecklistSubmitted(jobId: string): void {
  getOrCreate(jobId).startChecklistSubmitted = true;
}

/** Records that an after-photo has been captured for `jobId`. */
export function recordAfterPhoto(jobId: string): void {
  const state = getOrCreate(jobId);
  state.afterPhotoCount += 1;
}

/** Records that quality notes have been written for `jobId`. */
export function recordQualityNotes(jobId: string): void {
  getOrCreate(jobId).hasQualityNotes = true;
}

/** Clears all recorded workflow state for `jobId` (e.g. on completion). */
export function clearJobWorkflowState(jobId: string): void {
  stateByJobId.delete(jobId);
}

/**
 * Synchronous probe: has `job`'s start checklist been submitted?
 * Suitable for direct assignment to `Ctx.hasSubmittedStartChecklist`.
 */
export function hasSubmittedStartChecklist(job: { id: string }): boolean {
  return (stateByJobId.get(job.id) ?? EMPTY_STATE).startChecklistSubmitted;
}

/**
 * Synchronous probe: does `job` have at least one recorded after-photo?
 * Suitable for direct assignment to `Ctx.hasAfterPhotos`.
 */
export function hasAfterPhotos(job: { id: string }): boolean {
  return (stateByJobId.get(job.id) ?? EMPTY_STATE).afterPhotoCount > 0;
}

/**
 * Synchronous probe: have quality notes been recorded for `job`?
 * Suitable for direct assignment to `Ctx.hasQualityNotes`.
 */
export function hasQualityNotes(job: { id: string }): boolean {
  return (stateByJobId.get(job.id) ?? EMPTY_STATE).hasQualityNotes;
}
