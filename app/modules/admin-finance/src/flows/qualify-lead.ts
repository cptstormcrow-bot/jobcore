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
import type { CalendarEventRepository, CustomerRepository, JobRepository, LeadRepository } from '../data/ports';

export interface QualifyLeadDeps {
  jobs: JobRepository;
  leads: LeadRepository;
  customers: CustomerRepository;
  /**
   * Workstream E (`app/supabase/0014_calendar_events.sql`) — logs the
   * `new` -> `qualified` transition below as a calendar event. Required,
   * not optional: `writeAudit()` is confirmed dead code, so this explicit
   * call is the only record of the transition outside `jobs.status`.
   */
  calendarEvents: CalendarEventRepository;
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

  // P3f.5a: create/link the Customer record, then create the `new`-status job.
  const customer = await deps.customers.create({
    organizationId: draft.job.organizationId,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
  });
  const jobWithCustomer = { ...draft.job, customerId: customer.id };
  const newJob = await deps.jobs.create(jobWithCustomer);

  // P3f.5b: the ONLY approved path to `qualified` — never `newJob.status = ...`.
  const transitionedJob = await transitionJob(newJob, 'qualified', deps.ctx);

  // Workstream E: persist the computed status (transitionJob is a thin
  // pass-through that never writes to the repository — see its doc
  // comment) and log the transition as a calendar event.
  const qualifiedJob = await deps.jobs.updateStatus(transitionedJob.id, transitionedJob.status);
  await deps.calendarEvents.logTransition(qualifiedJob.organizationId, qualifiedJob.id, newJob.status, qualifiedJob.status);

  // P3f.5c: stamp the source lead's backlink + timestamp.
  const qualifiedAt = deps.ctx.now();
  const updatedLead = await deps.leads.markQualified(lead.id, qualifiedJob.id, qualifiedAt);

  return { ok: true, job: qualifiedJob, lead: updatedLead };
}
