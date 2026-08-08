/**
 * Qualify-lead flow (P3f.5a, P3f.5b, P3f.5c).
 *
 * Orchestrates the three steps `03-P3-admin-finance.md`'s AC-2 requires in
 * one place, each delegated to its owning seam rather than re-implemented
 * here:
 *   1. (P3f.5a) Build a `new`-status job payload from the qualified lead —
 *      `domain/qualify.ts`'s `buildJobFromLead` — and persist it via
 *      `JobRepository.create`.
 *   2. (P3f.5b) Advance that job `new` → `qualified` — `state-machine.ts:115`
 *      (`{ from: 'new', to: 'qualified', roles: OFFICE }`, no precondition) —
 *      through `domain/transition.ts`'s `transitionJob`, the module's SOLE
 *      `applyTransition` call site (AC-4). This flow never writes
 *      `job.status =` itself.
 *   3. (P3f.5c) Stamp `converted_job_id` (AC-2) and `qualified_at` on the
 *      SOURCE LEAD via `LeadRepository.markQualified` — both columns
 *      `domain/lead.ts`'s `LeadRow`/`Lead` already declare, so no schema or
 *      domain-type widening was needed for this step.
 *
 * Props-in/callbacks-out: every dependency (`JobRepository`, `LeadRepository`,
 * `Ctx`) arrives as a parameter — this file never imports sqlite/fetch/
 * Supabase directly, mirroring every other seam in this module.
 *
 * Not a atomic DB transaction — the three steps run as three sequential
 * awaits. If step 2 or 3 throws, the caller sees the job left in whatever
 * state the earlier step(s) reached; there is no rollback here, matching
 * `transitionJob`'s own "thin pass-through" scope. Wiring a real transaction
 * is a host-side (repository implementation) concern, not this flow's.
 */

import type { Ctx, Job } from '@jobcore/core';
import type { Lead } from '../domain/lead';
import { buildJobFromLead } from '../domain/qualify';
import { transitionJob } from '../domain/transition';
import type { JobRepository, LeadRepository } from '../data/ports';

export interface QualifyLeadDeps {
  jobs: JobRepository;
  leads: LeadRepository;
  ctx: Ctx;
}

export type QualifyLeadResult =
  | { ok: true; job: Job; lead: Lead }
  | { ok: false; reason: string };

/**
 * Qualifies `lead` into a `qualified`-status job. `serviceAreaId` is the
 * caller's already-resolved `service_areas.id` lookup for the lead's
 * address (`buildJobFromLead` never queries the DB itself — see its doc
 * comment); pass `null` when no service area matched.
 */
export async function qualifyLead(
  lead: Lead,
  serviceAreaId: string | null,
  deps: QualifyLeadDeps
): Promise<QualifyLeadResult> {
  const draft = buildJobFromLead(lead, serviceAreaId);
  if (!draft.ok) {
    return { ok: false, reason: draft.reason };
  }

  // P3f.5a: create the `new`-status job.
  const newJob = await deps.jobs.create(draft.job);

  // P3f.5b: the ONLY approved path to `qualified` — never `newJob.status = ...`.
  const qualifiedJob = await transitionJob(newJob, 'qualified', deps.ctx);

  // P3f.5c: stamp the source lead's backlink + timestamp.
  const qualifiedAt = deps.ctx.now();
  const updatedLead = await deps.leads.markQualified(lead.id, qualifiedJob.id, qualifiedAt);

  return { ok: true, job: qualifiedJob, lead: updatedLead };
}
