export type JobActionStage = 'contact' | 'arrive' | 'complete' | 'paid';
export const JOB_ACTION_STAGES: readonly JobActionStage[] = ['contact', 'arrive', 'complete', 'paid'];

export type JobSubViewInput = {
  isCreate: boolean;
  region: string;
  activeStage?: JobActionStage | null;
  // Ignored: tech and admin share one estimate screen (#0057). Kept so callers still compile.
  isTechEstimate?: boolean;
};

export function jobSubViewFor(input: JobSubViewInput): string | undefined {
  if (input.isCreate) return undefined;
  if (input.activeStage) return `job:${input.activeStage}`;
  switch (input.region) {
    case 'plan':
      return 'job:plan';
    case 'evisit':
      return 'job:prelim';
    case 'assign':
      return 'job:assign';
    case 'schedule':
      return 'job:schedule';
    case 'closeout':
      return 'closeOutReview';
    case 'estimate':
      return 'jobEstimate';
    default:
      return undefined;
  }
}
