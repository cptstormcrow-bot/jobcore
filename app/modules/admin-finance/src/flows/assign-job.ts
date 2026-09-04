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
 *   - `-> 'assigned'`, guarded the same way — every job this flow handles
 *     ends at `scheduled` (either already there, or just advanced to it by
 *     the edge above), and `scheduled` → `assigned` is always legal. It is
 *     NOT fired unconditionally: the flow re-reads the job through
 *     `JobRepository.getById` before any write, because a stale caller-held
 *     copy would otherwise drive this edge from `assigned` and throw
 *     `"no transition from 'assigned' to 'assigned'"`.
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
   * transition below (`qualified` -> `scheduled` when it fires, and
   * `-> assigned` when the job isn't already `assigned`) as a calendar event.
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

  // Re-read before any write. `job` is the caller's in-memory copy, and the
  // assignment board does not refetch after a successful assign, so a second
  // Confirm press arrives here still claiming `qualified` while the row is
  // already `assigned`. That used to pass the guard above, write a SECOND
  // `job_assignments` row (0004_scheduling.sql declares no (job_id, tech_id)
  // uniqueness), and then throw from edge 2 below.
  let current: Job;
  try {
    const fetched = await deps.jobs.getById(job.id);
    if (fetched === null) {
      return { ok: false, reason: 'That job no longer exists.' };
    }
    current = fetched;
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Failed to re-read this job.',
    };
  }

  // Idempotent no-op: the assignment already landed (typically press 1 of a
  // double-press). Report success instead of duplicating the row.
  if (current.status === 'assigned' && current.assignedTechId === techId) {
    return { ok: true, job: current };
  }

  // Re-run the entry guard against the authoritative status, not the stale
  // one. Reassignment (`assigned` -> a different tech) has no transition
  // table entry and is correctly rejected here rather than thrown from.
  if (current.status !== 'qualified' && current.status !== 'scheduled') {
    return {
      ok: false,
      reason: `Cannot assign a job in status "${current.status}"; expected "qualified" or "scheduled".`,
    };
  }

  // P3g.6a: insert the job_assignments row FIRST — a DB-level trigger can
  // reject this (e.g. the tech has an approved time-off/blackout overlapping
  // the job's scheduled dates), and must do so before any job-row write
  // happens, so a rejected assignment never leaves `assigned_tech_id`
  // incorrectly patched with no assignment row to back it.
  const assignedAt = deps.ctx.now();
  try {
    await deps.assignments.create(job.organizationId, {
      jobId: job.id,
      techId,
      assignedAt,
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Failed to create job assignment.',
    };
  }

  // Everything past the assignment row is wrapped: `patchScheduling`,
  // `transitionJob`, `updateStatus` and `logTransition` all throw on failure,
  // and a throw escaping this function breaks its declared
  // `Promise<AssignJobResult>` contract — the caller gets an unhandled
  // rejection instead of a `reason` it can surface.
  try {
    // P3g.6a: set assigned_tech_id via the existing scheduling-patch seam —
    // only after the assignment row was accepted above.
    const patchedJob = await deps.jobs.patchScheduling(job.id, { assignedTechId: techId });

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

    // P3g.6b, edge 2 of 2 — guarded for the same reason edge 1 is:
    // 'assigned' -> 'assigned' has no transition table entry and throws. The
    // re-read above makes that unreachable on the single-client path; this
    // guard covers a concurrent assign landing between that read and here.
    let assignedJob = scheduledJob;
    if (scheduledJob.status !== 'assigned') {
      const transitionedToAssigned = await transitionJob(scheduledJob, 'assigned', deps.ctx);
      // Workstream E: persist + log this edge too.
      assignedJob = await deps.jobs.updateStatus(transitionedToAssigned.id, transitionedToAssigned.status);
      await deps.calendarEvents.logTransition(assignedJob.organizationId, assignedJob.id, scheduledJob.status, assignedJob.status);
    }

    return { ok: true, job: assignedJob };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Failed to assign this job.',
    };
  }
}
