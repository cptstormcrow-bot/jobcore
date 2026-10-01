/**
 * Unassign-job flow.
 *
 * Unassign: remove the tech and return the job to Scheduled so it reappears
 * on the Assignments board. Mirrors `assign-job.ts`'s shape — every
 * dependency arrives as a parameter, and the status edge goes through
 * `domain/transition.ts`'s `transitionJob` (assigned -> scheduled), never a
 * direct `job.status =` write.
 * Unassign works at any status; only 'assigned' steps back to 'scheduled' —
 * every other status keeps its status and just loses its tech/assignments.
 *
 * Validate-then-write, fail closed: the job is re-read, the transition is
 * computed and the status is checked BEFORE any write happens, so a refused
 * unassign never leaves a half-removed assignment.
 *
 * Not an atomic DB transaction — sequential awaits, same scope note as
 * `assign-job.ts`.
 */

import type { Job } from '@jobcore/core';
import { transitionJob } from '../domain/transition';
import type { AssignJobDeps, AssignJobResult } from './assign-job';

export type UnassignJobDeps = AssignJobDeps;

export type UnassignJobResult = AssignJobResult;

export async function unassignJob(
  job: Job,
  deps: UnassignJobDeps
): Promise<UnassignJobResult> {
  try {
    // Re-read before any write — the caller's copy may be stale.
    const fresh = await deps.jobs.getById(job.id);
    if (fresh === null) {
      return { ok: false, reason: 'That job no longer exists.' };
    }

    // Validate first: compute the transition before any write.
    let transitioned: Job | null = null;
    if (fresh.status === 'assigned') {
      transitioned = await transitionJob(fresh, 'scheduled', deps.ctx);
    }
    // Any other status: no status change — only the assignment links and tech are cleared.

    // Writes.
    await deps.assignments.removeForJob(fresh.id);
    let updated = await deps.jobs.patchScheduling(fresh.id, { assignedTechId: null });

    if (transitioned !== null) {
      updated = await deps.jobs.updateStatus(transitioned.id, transitioned.status);
      await deps.calendarEvents.logTransition(updated.organizationId, updated.id, fresh.status, updated.status);
    }

    return { ok: true, job: updated };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Failed to unassign this job.',
    };
  }
}
