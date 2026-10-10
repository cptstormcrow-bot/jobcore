export type JobActionStage = 'contact' | 'arrive' | 'complete' | 'paid';
export const JOB_ACTION_STAGES: readonly JobActionStage[] = ['contact', 'arrive', 'complete', 'paid'];

export type JobSubViewInput = {
  isCreate: boolean;
  region: string;
  activeStage?: JobActionStage | null;
  // isTechEstimate must be the SAME boolean that decides JobEstimateEditor vs JobEstimateScreen
  // in the job host, not the admin flag.
  isTechEstimate: boolean;
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
    case 'estimate':
      return input.isTechEstimate ? 'job:estimate-tech' : 'jobEstimate';
    default:
      return undefined;
  }
}
