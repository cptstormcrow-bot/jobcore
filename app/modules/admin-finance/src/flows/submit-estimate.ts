import type { Ctx } from '@jobcore/core';
import type { EstimateRepository, JobEstimate } from '../data/ports';

/**
 * P3f.5a — submitEstimate: tech- or admin-initiated transition of a job_estimates
 * row from 'draft' to 'submitted'. This governs JobEstimate.status only — it does
 * NOT call transitionJob()/state-machine.ts, which governs the separate
 * public.jobs.status state machine. No rollback on partial failure (matches
 * transitionJob's own thin pass-through scope).
 */
export interface SubmitEstimateDeps {
  estimates: EstimateRepository;
  ctx: Ctx;
  now: () => string;
}

export type SubmitEstimateResult =
  | { ok: true; estimate: JobEstimate }
  | { ok: false; reason: string };

export async function submitEstimate(
  estimate: JobEstimate,
  deps: SubmitEstimateDeps
): Promise<SubmitEstimateResult> {
  if (estimate.status !== 'draft') {
    return { ok: false, reason: `submitEstimate: estimate for job ${estimate.jobId} is not in 'draft' status (got '${estimate.status}')` };
  }
  const updated = await deps.estimates.upsertForJob(estimate.jobId, { status: 'submitted' });
  return { ok: true, estimate: updated };
}
