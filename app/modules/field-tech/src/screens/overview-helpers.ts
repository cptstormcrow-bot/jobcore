/**
 * Pure helpers extracted from `Overview.tsx` so the Overview tile counts can be
 * exercised under the plain-node assertion runner without pulling in
 * `react-native` / `@jobcore/ui` at runtime (same pattern as
 * `day-list-helpers.ts`).
 */

import type { Job } from '@jobcore/core';

/** Job statuses that count as "closed out" — everything else counts as open. */
export const CLOSED_JOB_STATUSES: ReadonlySet<Job['status']> = new Set([
  'completed',
  'paid',
  'closed',
  'declined',
  'cancelled',
]);

export interface OverviewCounts {
  assignedJobs: number;
  openJobs: number;
  timeOffPending: number;
  timeOffApproved: number;
  reimbursementsPending: number;
  reimbursementsApproved: number;
  reimbursementsRejected: number;
  jobNotes: number;
  jobPhotos: number;
  checklistOpen: number;
  checklistSubmitted: number;
}

export const EMPTY_COUNTS: OverviewCounts = {
  assignedJobs: 0,
  openJobs: 0,
  timeOffPending: 0,
  timeOffApproved: 0,
  reimbursementsPending: 0,
  reimbursementsApproved: 0,
  reimbursementsRejected: 0,
  jobNotes: 0,
  jobPhotos: 0,
  checklistOpen: 0,
  checklistSubmitted: 0,
};

/** Inputs for {@link computeOverviewCounts}; per-job arrays align with `jobs`. */
export interface OverviewCountInputs {
  jobs: readonly Job[];
  timeOff: readonly { status: string }[];
  reimbursements: readonly { status: string }[];
  /** Note count per job (same order as `jobs`). */
  notesPerJob: readonly number[];
  /** Photo count per job (same order as `jobs`). */
  photosPerJob: readonly number[];
  /** Per job: [open, submitted] checklist instance counts. */
  checklistPerJob: readonly (readonly [number, number])[];
}

/** Pure: derives every Overview tile count. No React, no hooks. */
export function computeOverviewCounts(input: OverviewCountInputs): OverviewCounts {
  const countStatus = (list: readonly { status: string }[], status: string): number =>
    list.filter((item) => item.status === status).length;
  let checklistOpen = 0;
  let checklistSubmitted = 0;
  for (const [open, submitted] of input.checklistPerJob) {
    checklistOpen += open;
    checklistSubmitted += submitted;
  }
  return {
    assignedJobs: input.jobs.length,
    openJobs: input.jobs.filter((job) => !CLOSED_JOB_STATUSES.has(job.status)).length,
    timeOffPending: countStatus(input.timeOff, 'pending'),
    timeOffApproved: countStatus(input.timeOff, 'approved'),
    reimbursementsPending: countStatus(input.reimbursements, 'pending'),
    reimbursementsApproved: countStatus(input.reimbursements, 'approved'),
    reimbursementsRejected: countStatus(input.reimbursements, 'rejected'),
    jobNotes: input.notesPerJob.reduce((sum, n) => sum + n, 0),
    jobPhotos: input.photosPerJob.reduce((sum, n) => sum + n, 0),
    checklistOpen,
    checklistSubmitted,
  };
}
