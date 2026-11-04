import type { Job } from '@jobcore/core';
import { deriveStageStates, deriveNextStep, estimateStageFlags } from '@jobcore/core';
import type { StageBlockers, StageInputs, StageKey } from '@jobcore/core';
import type { JobEstimate, JobInvestigation } from '../../../../modules/admin-finance/src/data/ports';

export type JobStageExtras = {
  contactedAt: string | null;
  stageMarks: Record<string, string>;
  upstreamChangedAt: string | null;
  createdAt: string | null;
  photoCount: number;
  lead: { id: string } | null;
};

export function buildJobStageResults({
  job,
  estimate,
  investigation,
  investigatorTechId,
  stageExtras,
  paidInFull = false,
}: {
  job: Job | null;
  estimate: JobEstimate | null;
  investigation: JobInvestigation | null;
  investigatorTechId: string | null;
  stageExtras: JobStageExtras | null;
  paidInFull?: boolean;
}) {
  if (!job) return null;
  const marks = stageExtras?.stageMarks ?? {};
  const done = (complete: boolean, key: StageKey, fallback?: string | null) => ({
    complete,
    completedAt: complete ? marks[key] ?? fallback ?? null : null,
  });
  const closed = job.status === 'closed';
  const pastCompletion = ['completed', 'paid', 'closed', 'archived'].includes(job.status);
  const flags = estimateStageFlags(estimate?.status ?? null);
  const inputs: StageInputs = {
    // Job never turns yellow (Jeff); its changedAt still yellows the later non-sticky stages.
    job: { ...done(true, 'job', job.createdAt), changedAt: stageExtras?.upstreamChangedAt ?? null, sticky: true },
    prem: {
      complete: !!investigation?.submittedAt,
      completedAt: investigation?.submittedAt ? (marks.prem ?? marks.completePrem ?? investigation.submittedAt) : null,
      // One Prem dot: gray = needed or not, yellow = a Prem tech has claimed it, green = report submitted.
      inProgress: !!investigatorTechId && !investigation?.submittedAt,
      notRequired: !job.needsPremAt && !investigatorTechId,
      sticky: true,
    },
    estimate: { ...done(flags.approvalComplete, 'estimate', estimate?.updatedAt), rejected: flags.rejected, inProgress: estimate?.status === 'submitted', sticky: true },
    approval: { ...done(flags.approvalComplete, 'approval', estimate?.updatedAt), rejected: flags.rejected, sticky: true },
    schedule: done(!!job.scheduledStart, 'schedule'),
    assign: done(!!(job.assignedTechId), 'assign'),
    contact: { ...done(!!stageExtras?.contactedAt, 'contact', stageExtras?.contactedAt), sticky: true },
    startWork: { ...done(!!job.inProgressAt, 'startWork', job.inProgressAt), sticky: true },
    // A stale completedAt on a job sent back to in progress does not count (job #3, Jeff 2026-11-02).
    completeWork: { ...done(pastCompletion && !!job.completedAt, 'completeWork', job.completedAt), sticky: true },
    // Paid follows the money, not completion: a job paid in full while in progress shows Paid (Jeff).
    paid: done(paidInFull || job.status === 'paid' || closed, 'paid'),
    closeout: done(closed, 'closeout'),
  };
  const derived = deriveStageStates(inputs);
  // Draft/none stays gray (Jeff: gray draft, yellow submitted, green approved).
  const states = (estimate?.status ?? 'draft') === 'draft'
    ? derived.map((s) => (s.key === 'estimate' ? { ...s, state: 'gray' as const } : s))
    : derived;
  // Roadblocks shown in Next Steps, matching what the stage's own screen would refuse with.
  const blockers: StageBlockers = {};
  if (job.status === 'cancelled') {
    blockers.startWork = 'the job is cancelled';
    blockers.completeWork = 'the job is cancelled';
  } else {
    if (!job.assignedTechId) blockers.startWork = 'needs an installer tech';
    if (job.status !== 'in_progress' && !pastCompletion) blockers.completeWork = 'start the job first';
  }
  if (!pastCompletion) blockers.closeout = 'complete the job first';
  return { states, nextStep: deriveNextStep(states, blockers) };
}
