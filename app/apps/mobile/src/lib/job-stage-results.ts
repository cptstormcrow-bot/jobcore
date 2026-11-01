import type { Job } from '@jobcore/core';
import { deriveStageStates, deriveNextStep, estimateStageFlags } from '@jobcore/core';
import type { StageInputs, StageKey } from '@jobcore/core';
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
}: {
  job: Job | null;
  estimate: JobEstimate | null;
  investigation: JobInvestigation | null;
  investigatorTechId: string | null;
  stageExtras: JobStageExtras | null;
}) {
  if (!job) return null;
  const marks = stageExtras?.stageMarks ?? {};
  const done = (complete: boolean, key: StageKey, fallback?: string | null) => ({
    complete,
    completedAt: complete ? marks[key] ?? fallback ?? null : null,
  });
  const closed = job.status === 'closed';
  const flags = estimateStageFlags(estimate?.status ?? null);
  const inputs: StageInputs = {
    lead: done(true, 'lead'),
    // Job never turns yellow (Jeff); its changedAt still yellows the later non-sticky stages.
    job: { ...done(true, 'job', job.createdAt), changedAt: stageExtras?.upstreamChangedAt ?? null, sticky: true },
    premAvailable: {
      complete: !!investigation?.submittedAt,
      completedAt: investigation?.submittedAt ?? null,
      // Gray = Prem needed (or not needed), yellow = a Prem tech has claimed it, green = report submitted.
      inProgress: !!investigatorTechId && !investigation?.submittedAt,
      notRequired: !job.needsPremAt && !investigatorTechId,
      sticky: true,
    },
    completePrem: { ...done(!!investigation?.submittedAt, 'completePrem', investigation?.submittedAt), sticky: true },
    estimate: { ...done(flags.approvalComplete, 'estimate', estimate?.updatedAt), rejected: flags.rejected, inProgress: estimate?.status === 'submitted', sticky: true },
    approval: { ...done(flags.approvalComplete, 'approval', estimate?.updatedAt), rejected: flags.rejected, sticky: true },
    schedule: done(!!job.scheduledStart, 'schedule'),
    assign: done(!!(job.assignedTechId), 'assign'),
    contact: { ...done(!!stageExtras?.contactedAt, 'contact', stageExtras?.contactedAt), sticky: true },
    startWork: { ...done(!!job.inProgressAt, 'startWork', job.inProgressAt), sticky: true },
    photos: done((stageExtras?.photoCount ?? 0) >= 1, 'photos'),
    completeWork: { ...done(!!job.completedAt, 'completeWork', job.completedAt), sticky: true },
    paid: done(job.status === 'paid' || closed, 'paid'),
    closeout: done(closed, 'closeout'),
    history: done(closed, 'history'),
  };
  const derived = deriveStageStates(inputs);
  // Draft/none stays gray (Jeff: gray draft, yellow submitted, green approved).
  const states = (estimate?.status ?? 'draft') === 'draft'
    ? derived.map((s) => (s.key === 'estimate' ? { ...s, state: 'gray' as const } : s))
    : derived;
  return { states, nextStep: deriveNextStep(states) };
}
