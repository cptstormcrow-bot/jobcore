/**
 * Assign-investigator flow (Phase 1 of the investigator/installer split).
 *
 * Mirrors `assign-job.ts`'s orchestration idiom, but scoped to just the
 * investigator leg:
 *   1. Insert one `job_assignments` row via `JobAssignmentRepository.create`,
 *      with `kind: 'investigator'` — distinguishing this row from the
 *      default `'installer'` assignment `assign-job.ts` creates.
 *
 * Unlike `assign-job.ts`, this flow does NOT call `transitionJob()` and does
 * NOT patch `assignedTechId` on the job: assigning an investigator must not
 * move `public.jobs.status`, and must not overwrite the job's (installer)
 * `assigned_tech_id`. Only the eventual installer assignment — Phase 2,
 * untouched by this flow — is allowed to do either of those things.
 *
 * `job_assignments.kind` (`app/supabase/0023_field_ops_segway_and_estimating.sql`
 * lines 50-52) is a `text not null default 'installer' check (kind in
 * ('installer','investigator'))` column — `kind: 'investigator'` is a valid
 * value this flow writes explicitly, same `JobAssignmentDraft`/
 * `JobAssignmentRepository` ports `assign-job.ts` uses.
 *
 * Props-in/callbacks-out: every dependency arrives as a parameter — this
 * file never imports sqlite/fetch/Supabase directly, same convention as
 * `assign-job.ts` and `qualify-lead.ts`.
 *
 * Not an atomic DB transaction — same scope note as `assign-job.ts`'s doc
 * comment.
 */

import type { Ctx, Job } from '@jobcore/core';
import type { JobAssignmentRepository } from '../data/ports';

export interface AssignInvestigatorDeps {
  assignments: JobAssignmentRepository;
  ctx: Ctx;
}

export type AssignInvestigatorResult =
  | { ok: true; job: Job }
  | { ok: false; reason: string };

/**
 * Assigns an investigator (`techId`) to `job`. Writes a `job_assignments`
 * row with `kind: 'investigator'` only — never patches `job.assignedTechId`
 * and never advances `job.status`.
 */
export async function assignInvestigator(
  job: Job,
  techId: string,
  deps: AssignInvestigatorDeps
): Promise<AssignInvestigatorResult> {
  const assignedAt = deps.ctx.now();
  try {
    await deps.assignments.create(job.organizationId, {
      jobId: job.id,
      techId,
      assignedAt,
      kind: 'investigator',
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Failed to create investigator assignment.',
    };
  }

  return { ok: true, job };
}
