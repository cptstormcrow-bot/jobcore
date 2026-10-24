/**
 * Close-out flow — the `completed -> paid` / `paid -> closed` transition PLUS
 * its unconditional commission write (P3h.4a + P3h.4b).
 *
 * Scope: this flow drives the next close-out edge (`completed -> paid` or `paid -> closed`,
 * `domain/closeout.ts`'s `NEXT_CLOSE_OUT_STATUS` table) and then writes
 * exactly ONE `commissions` row for the job — additive on top of P3h.4a,
 * without changing this function's exported signature. The commission write
 * is NOT contingent on any review, photo, or note check; it fires whenever
 * the transition itself succeeds. `calculateCommission`
 * (`money/commission.ts`, P3-c) is reused verbatim, never reimplemented, so
 * the written row snapshots `priceSheetId`/`compensationPolicyId` exactly as
 * P3a.3's `commissions` table requires (both not null, on delete restrict,
 * one active row per job via `commissions_one_per_job_idx`). The row also
 * carries `deps.closedByUserId` — who closed the job — because `Ctx`
 * (`@jobcore/core`) carries a `role` but no actor identity to read that from.
 *
 * Like `assign-job.ts` / `domain/transition.ts`, this flow never imports
 * `state-machine.ts` and never calls `applyTransition` directly — it routes
 * the transition through `domain/transition.ts`'s `transitionJob`, the
 * module's SOLE `applyTransition` call site (AC-4). Eligibility is checked
 * via `domain/closeout.ts`'s `awaitingCloseOut`/`closeOutBlockers` (`Set.has()`
 * / lookup-table idioms), never a raw `status === '...'` comparison.
 */

import type { Ctx, Job } from '@jobcore/core';
import { transitionJob } from '../domain/transition';
import { awaitingCloseOut, closeOutBlockers, nextCloseOutStatus } from '../domain/closeout';
import { calculateCommission } from '../money/commission';
import type { CommissionLine, CompensationPolicy, PriceSheetRate } from '../money/types';
import type { CalendarEventRepository, CloseOutFailureRepository, CommissionRepository, JobRepository, PriceSheetRepository } from '../data/ports';

export interface CloseOutJobDeps {
  ctx: Ctx;
  /**
   * Workstream E (`app/supabase/0014_calendar_events.sql`) — persists the
   * `completed` -> `paid` transition below (`transitionJob` never writes to
   * the repository — see its doc comment) and logs it as a calendar event.
   */
  jobs: JobRepository;
  calendarEvents: CalendarEventRepository;
  /** Resolves the org's active `published` price sheet (P3a.3's `getActive`). */
  priceSheetRepository: PriceSheetRepository;
  /**
   * The commissioned tech/rep's compensation policy and the active price
   * sheet's rate rows. Neither has a repository port of its own yet, so the
   * caller resolves and supplies them directly — this flow only reuses
   * `calculateCommission` against them, never fetches them itself.
   */
  compensationPolicy: CompensationPolicy;
  rates: readonly PriceSheetRate[];
  commissionRepository: CommissionRepository;
  /** Who closed the job — `Ctx` has no actor identity field to read this from. */
  closedByUserId: string;
  /** Optional — records close-out failures/attempts for operator visibility and retry. */
  closeOutFailures?: CloseOutFailureRepository;
}

export type CloseOutJobResult =
  | { ok: true; job: Job; commission: CommissionLine }
  | { ok: false; reason: string };

/**
 * Advances `job` along its next close-out edge (`nextCloseOutStatus`:
 * `completed -> paid` or `paid -> closed`). Both edges write exactly ONE
 * `commissions` row via `closeOutWrite` (idempotent server-side).
 * Rejects before any write if `job` is not awaiting close-out, or if
 * `closeOutBlockers` reports a precondition failure for its next edge.
 */
export async function closeOutJob(job: Job, deps: CloseOutJobDeps): Promise<CloseOutJobResult> {
  const target = nextCloseOutStatus(job);
  if (!awaitingCloseOut(job) || target === null) {
    const reason = `Job ${job.id} is not awaiting close-out (status "${job.status}").`;
    await deps.closeOutFailures?.recordFailure(job.organizationId, job.id, 'not_ready', reason);
    return { ok: false, reason };
  }

  const blockers = closeOutBlockers(job, deps.ctx);
  const firstBlocker = blockers[0];
  if (firstBlocker !== undefined) {
    await deps.closeOutFailures?.recordFailure(job.organizationId, job.id, 'blocked', firstBlocker);
    return { ok: false, reason: firstBlocker };
  }

  const activePriceSheet = await deps.priceSheetRepository.getActive(job.organizationId);
  if (!activePriceSheet) {
    const reason = `No active price sheet for organization ${job.organizationId}; cannot write the commission for job ${job.id}.`;
    await deps.closeOutFailures?.recordFailure(job.organizationId, job.id, 'no_price_sheet', reason);
    return { ok: false, reason };
  }

  const commissionResult = calculateCommission(
    job,
    activePriceSheet,
    deps.compensationPolicy,
    deps.rates,
  );
  if (!commissionResult.ok) {
    await deps.closeOutFailures?.recordFailure(job.organizationId, job.id, 'commission_calc', commissionResult.reason);
    return { ok: false, reason: commissionResult.reason };
  }

  try {
    const transitionedJob = await transitionJob(job, target, deps.ctx);

    const updatedJob = await deps.jobs.closeOutWrite(
      transitionedJob.id,
      job.status,
      commissionResult.value,
      deps.closedByUserId,
    );

    // The RPC must land the job on the status we asked for. A database still on
    // the pre-0105 function leaves a `paid` job at `paid` and still reports
    // success, so catch that here instead of showing a false "closed".
    if (updatedJob.status !== target) {
      throw new Error(
        `the database left the job at "${updatedJob.status}" instead of "${target}" - apply migration 0105 (close_out_job_write)`,
      );
    }

    await deps.closeOutFailures?.resolve(job.id, 'resolved_retry', deps.closedByUserId);

    return { ok: true, job: updatedJob, commission: commissionResult.value };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await deps.closeOutFailures?.recordFailure(job.organizationId, job.id, 'write', reason);
    return { ok: false, reason: `close-out write failed for job ${job.id}: ${reason}` };
  }
}

/**
 * Operator-triggered retry of a previously failed close-out. Records the
 * retry attempt (if a `closeOutFailures` repository is configured) and then
 * re-invokes `closeOutJob` unchanged. `maxAttempts` is accepted for future
 * use but is not enforced in this pass — retry is operator-triggered only,
 * no auto-retry loop.
 */
export async function retryCloseOut(
  job: Job,
  deps: CloseOutJobDeps,
  maxAttempts = 5,
): Promise<CloseOutJobResult> {
  void maxAttempts;
  await deps.closeOutFailures?.recordAttempt(job.id);
  return closeOutJob(job, deps);
}
