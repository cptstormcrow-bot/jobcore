/**
 * Pure transition-ctx assembly + persist step for field-tech jobActions.
 * Extracted from index.ts (which imports react-native/expo) so it can be
 * exercised under plain node. The session and ports are passed in; index.ts
 * supplies them from `getModuleSession()` / `getModulePorts()`.
 */

import type { Job, Ctx } from '@jobcore/core';
import type { ModulePorts } from './module-ports';
import type { ModuleSession } from './module-session';

/**
 * Assembles the `Ctx` a jobAction's `onInvoke` needs to call `transitionJob`.
 * All four preconditions are wired to this module's own ports, never
 * reimplemented — `canTransition`/`applyTransition` (via `transitionJob`)
 * remain the sole owners of the precondition logic itself.
 */
export async function buildTransitionCtxFrom(
  job: Job,
  session: ModuleSession | null,
  ports: ModulePorts,
): Promise<Ctx> {
  // The state machine's probes are read synchronously (a Promise-returning
  // probe always fails closed), so await every input first and hand back
  // sync closures over the resolved values.
  const [instance, photos, notes] = await Promise.all([
    ports.checklist.getInstanceForJob(job.id, 'start'),
    ports.photos.listForJob(job.id),
    ports.notes.listForJob(job.id),
  ]);
  const startChecklistSubmitted = instance !== null && instance.submittedAt !== null;
  const afterPhotosPresent = photos.some((photo) => photo.kind === 'after');
  const qualityNotesPresent = notes.some((note) => note.kind === 'quality_notes');

  return {
    role: session ? session.role : 'tech',
    now: () => new Date().toISOString(),
    hasSubmittedStartChecklist: () => startChecklistSubmitted,
    hasAfterPhotos: () => afterPhotosPresent,
    hasQualityNotes: () => qualityNotesPresent,
    // field-tech never records a payment record itself; a job whose payer
    // is not the customer satisfies this precondition without one.
    hasPaymentRecord: () => job.payer !== 'customer',
  };
}

/**
 * Persists a `transitionJob` result and logs the transition to the
 * calendar (transition -> persist status -> log calendar event).
 */
export async function persistTransitionWith(
  originalJob: Job,
  transitionedJob: Job,
  session: ModuleSession | null,
  ports: ModulePorts,
): Promise<void> {
  const techId = session ? session.userId : originalJob.assignedTechId ?? '';

  await ports.jobs.updateStatusAsTech(transitionedJob.id, techId, transitionedJob.status);
  await ports.calendarEvents.logOwnTransition(
    transitionedJob.organizationId,
    transitionedJob.id,
    originalJob.status,
    transitionedJob.status,
  );
}
