import type { Ctx } from '@jobcore/core';
import type { EstimateRepository, EstimateStatus, JobEstimate } from '../data/ports';

/**
 * P3f.5b/P3f.5c — approveEstimate: admin-only transition of a job_estimates row
 * from 'submitted' to 'approved' or 'rejected'. Admin-only is enforced by RLS
 * (only job_estimates_admin_all can write any status other than the tech's
 * whitelisted draft->submitted). Deliberately does NOT call transitionJob() —
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
  decision: Extract<EstimateStatus, 'approved' | 'rejected'>,
  deps: ApproveEstimateDeps
): Promise<ApproveEstimateResult> {
  if (estimate.status !== 'submitted') {
    return { ok: false, reason: `approveEstimate: estimate for job ${estimate.jobId} is not in 'submitted' status (got '${estimate.status}')` };
  }
  const updated = await deps.estimates.upsertForJob(estimate.jobId, { status: decision });
  return { ok: true, estimate: updated };
}
