import type { Ctx } from '@jobcore/core';
import type { EstimateRepository, EstimateStatus, JobEstimate } from '../data/ports';

/**
 * P3f.5b/P3f.5c — approveEstimate: admin-only transition of a job_estimates row
 * from 'submitted' to 'approved' only. Admin-only is enforced by the UI
 * role map in packages/core estimateStatus.ts; the DB policy on job_estimates
 * is only job_estimates_org_all (org-scoped, migration 0036), not admin-only.
 * Deliberately does NOT call transitionJob() —
 * the job itself stays at its current public.jobs.status; auto-advancing
 * Job.status on estimate approval is deferred to Increment 4 (out of scope
 * here). No rollback on partial failure (matches transitionJob's own thin
 * pass-through scope).
 */
export interface ApproveEstimateDeps {
  estimates: EstimateRepository;
  ctx: Ctx;
  now: () => string;
}

export type ApproveEstimateResult =
  | { ok: true; estimate: JobEstimate }
  | { ok: false; reason: string };

export async function approveEstimate(
  estimate: JobEstimate,
  decision: Extract<EstimateStatus, 'approved'>,
  deps: ApproveEstimateDeps
): Promise<ApproveEstimateResult> {
  if (estimate.status !== 'submitted') {
    return { ok: false, reason: `approveEstimate: estimate for job ${estimate.jobId} is not in 'submitted' status (got '${estimate.status}')` };
  }
  const updated = await deps.estimates.upsertForJob(estimate.jobId, { status: decision });
  return { ok: true, estimate: updated };
}
