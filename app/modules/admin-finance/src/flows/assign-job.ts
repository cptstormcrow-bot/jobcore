/**
 * Assign-job flow (P3g.6a, P3g.6b).
 *
 * Orchestrates `03-P3-admin-finance.md` §4's assignment step in one place:
 *   "Assigning sets `assigned_tech_id`, writes a `job_assignments` row, and
 *   advances the job via `applyTransition` — never by writing `status`
 *   directly."
 *
 * Steps, each delegated to its owning seam rather than re-implemented here
 * (mirrors `qualify-lead.ts`'s three-step orchestration pattern):
 *   1. (P3g.6a) Patch `assignedTechId` onto the job via
 *      `JobRepository.patchScheduling` — `JobSchedulingPatch` already
 *      includes `assignedTechId` (`data/ports.ts`), so no new job-write
 *      method was needed for this part.
 *   2. (P3g.6a) Insert one `job_assignments` row via the new
 *      `JobAssignmentRepository.create` (`app/supabase/0004_scheduling.sql`
 *      shape: `job_id`, `tech_id`, `assigned_at`).
 *   3. (P3g.6b) Advance the job's status through the board's two possible
 *      starting points — `qualified` and `scheduled` — to `assigned`, via
 *      `domain/transition.ts`'s `transitionJob`, the module's SOLE
 *      `applyTransition` call site (AC-4). This flow never writes
 *      `job.status =` itself.
 *
 * TWO literal `transitionJob` call sites exist below, per P3g.6b:
 *   - `qualified` → `scheduled`, fired ONLY when the job's starting status is
 *     `qualified` — `state-machine.ts`'s `canTransition` fails closed on an
 *     exact `(from, to)` match, so calling this edge when the job is already
 *     `scheduled` would throw `"no transition from 'scheduled' to
 *     'scheduled'"`. The board assigns jobs from BOTH starting statuses
 *     (`03-P3-admin-finance.md` §4), so this edge must be conditional.
 *   - `-> 'assigned'`, fired unconditionally — every job this flow handles
 *     ends at `scheduled` (either already there, or just advanced to it by
 *     the edge above), and `scheduled` → `assigned` is always legal.
 *
 * Props-in/callbacks-out: every dependency (`JobRepository`,
 * `JobAssignmentRepository`, `Ctx`) arrives as a parameter — this file never
 * imports sqlite/fetch/Supabase directly, mirroring `qualify-lead.ts`.
 *
 * Not an atomic DB transaction — the steps run as sequential awaits, same
 * scope note as `qualify-lead.ts`'s doc comment.
 */

import type { Ctx, Job } from '@jobcore/core';
import { transitionJob } from '../domain/transition';
import type { CalendarEventRepository, JobRepository, JobAssignmentRepository } from '../data/ports';

export interface AssignJobDeps {
  jobs: JobRepository;
  assignments: JobAssignmentRepository;
  /**
   * Workstream E (`app/supabase/0014_calendar_events.sql`) — logs each
   * transition below (`qualified` -> `scheduled` when it fires, and the
   * unconditional `-> assigned`) as a calendar event.
   */
  calendarEvents: CalendarEventRepository;
  ctx: Ctx;
}

export type AssignJobResult =
  | { ok: true; job: Job }
  | { ok: false; reason: string };

/**
 * Assigns `job` to `techId`. `job` must be in `qualified` or `scheduled`
 * status — anything else is rejected before any write happens, since this
 * flow only knows how to drive those two starting points to `assigned`.
 */
export async function assignJob(
  job: Job,
  techId: string,
  deps: AssignJobDeps
): Promise<AssignJobResult> {
  if (job.status !== 'qualified' && job.status !== 'scheduled') {
    return {
      ok: false,
      reason: `Cannot assign a job in status "${job.status}"; expected "qualified" or "scheduled".`,
    };
  }

  // P3g.6a: set assigned_tech_id via the existing scheduling-patch seam.
  const patchedJob = await deps.jobs.patchScheduling(job.id, { assignedTechId: techId });

  // P3g.6a: insert the job_assignments row.
  const assignedAt = deps.ctx.now();
  await deps.assignments.create(job.organizationId, {
    jobId: job.id,
    techId,
    assignedAt,
  });

  // P3g.6b, edge 1 of 2 — ONLY fires when starting status is 'qualified'.
  // Never called unconditionally: 'scheduled' -> 'scheduled' has no
  // transition table entry and would throw.
  let scheduledJob = patchedJob;
  if (patchedJob.status === 'qualified') {
    const transitionedToScheduled = await transitionJob(patchedJob, 'scheduled', deps.ctx);
    // Workstream E: persist (transitionJob never writes to the repository)
    // and log the transition.
    scheduledJob = await deps.jobs.updateStatus(transitionedToScheduled.id, transitionedToScheduled.status);
    await deps.calendarEvents.logTransition(scheduledJob.organizationId, scheduledJob.id, patchedJob.status, scheduledJob.status);
  }

  // P3g.6b, edge 2 of 2 — always fires; 'scheduled' -> 'assigned' is always legal.
  const transitionedToAssigned = await transitionJob(scheduledJob, 'assigned', deps.ctx);
  // Workstream E: persist + log this edge too.
  const assignedJob = await deps.jobs.updateStatus(transitionedToAssigned.id, transitionedToAssigned.status);
  await deps.calendarEvents.logTransition(assignedJob.organizationId, assignedJob.id, scheduledJob.status, assignedJob.status);

  return { ok: true, job: assignedJob };
}
