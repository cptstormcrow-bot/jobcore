/**
 * Pure Completion-screen decisions (submit gate, "can this job be completed"
 * notice) kept free of React / `react-native` / `@jobcore/*` imports so they
 * can be exercised under the plain-node assertion runner. Imported by
 * Completion.tsx, the job screen's handleComplete, and the route
 * app/job/complete/[jobId].tsx.
 */

export interface CompletionGateInput {
  checklistComplete: boolean;
  afterPhotoCount: number;
  notes: string;
  submitting: boolean;
}

/** Submit gate: checklist done, at least one after-photo, non-blank notes, not already submitting. */
export function canSubmitCompletion(input: CompletionGateInput): boolean {
  return (
    input.checklistComplete &&
    input.afterPhotoCount > 0 &&
    input.notes.trim().length > 0 &&
    !input.submitting
  );
}

export interface CompletionBlockInput {
  status: string;
  completedAt?: string | null;
}

// Job lifecycle: ... in_progress -> completed -> paid -> closed -> archived.
// Only 'in_progress' may move to 'completed', so 'completed' and everything
// downstream of it (paid, closed, archived) is "past completion".
const PAST_COMPLETION = ['completed', 'paid', 'closed', 'archived'];

const MSG_ALREADY_COMPLETE = 'This job is already complete.';
const MSG_CANCELLED = 'This job was cancelled, so it cannot be completed.';
const MSG_NOT_STARTED = 'Start the job first, then you can complete it.';

/** Plain-language reason a job cannot be completed, or null when it can. */
export function completionBlockedNotice(job: CompletionBlockInput): string | null {
  const completedSet = job.completedAt !== undefined && job.completedAt !== null && job.completedAt !== '';
  if (completedSet || PAST_COMPLETION.includes(job.status)) return MSG_ALREADY_COMPLETE;
  if (job.status === 'cancelled') return MSG_CANCELLED;
  if (job.status !== 'in_progress') return MSG_NOT_STARTED;
  return null;
}
