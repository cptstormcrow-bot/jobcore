// Pure derivation of the 15-stage job progress bar and its "Next Steps" sentence. No I/O.

export const STAGE_KEYS = [
  'lead', 'job', 'premAvailable', 'completePrem', 'estimate', 'approval', 'schedule', 'assign',
  'contact', 'startWork', 'photos', 'completeWork', 'paid', 'closeout', 'history',
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  lead: 'Lead',
  job: 'Job',
  premAvailable: 'Prem available',
  completePrem: 'Complete Prem',
  estimate: 'Estimate',
  approval: 'Approval',
  schedule: 'Schedule',
  assign: 'Assign',
  contact: 'Contact',
  startWork: 'Start work',
  photos: 'Photos',
  completeWork: 'Complete work',
  paid: 'Paid',
  closeout: 'Closeout',
  history: 'History',
};

export type StageState = 'gray' | 'green' | 'yellow' | 'red';

/** Facts about one stage; timestamps are ISO strings. */
export interface StageInput {
  complete: boolean;
  completedAt?: string | null;
  changedAt?: string | null;
  missingRequired?: boolean;
  /** True when the stage is under way but not complete (e.g. a prem is assigned, report not yet submitted); renders yellow. */
  inProgress?: boolean;
  /** True when the stage was explicitly rejected (e.g. an estimate rejected by an admin); renders red and is never treated as done. Wins over `complete`. */
  rejected?: boolean;
}

export type StageInputs = Record<StageKey, StageInput>;

export interface StageResult {
  key: StageKey;
  state: StageState;
  doneAt: string | null;
}

export function deriveStageStates(inputs: StageInputs): StageResult[] {
  return STAGE_KEYS.map((key, i) => {
    const cur = inputs[key];
    let state: StageState;
    if (cur.rejected) {
      state = 'red';
    } else if (cur.complete) {
      state = 'green';
      if (cur.missingRequired) state = 'yellow';
      else if (cur.completedAt) {
        // Yellow when any earlier stage changed after this one was completed.
        for (let j = 0; j < i; j++) {
          const prev = STAGE_KEYS[j]; if (!prev) continue; const changed = inputs[prev].changedAt;
          if (changed && Date.parse(changed) > Date.parse(cur.completedAt)) {
            state = 'yellow';
            break;
          }
        }
      }
    } else {
      // Red when a later stage is already complete (this one needs redoing).
      if (cur.inProgress) state = 'yellow';
      else state = STAGE_KEYS.slice(i + 1).some((k) => inputs[k].complete) ? 'red' : 'gray';
    }
    return { key, state, doneAt: cur.complete && !cur.rejected ? cur.completedAt ?? null : null };
  });
}

/** Index of the last green/yellow stage, or -1; drives the green leading line. */
export function leadingIndex(states: StageResult[]): number {
  for (let i = states.length - 1; i >= 0; i--) {
    const s = states[i]?.state; if (s === 'green' || s === 'yellow') return i;
  }
  return -1;
}

const NEXT_PHRASE: Record<StageKey, string> = {
  lead: 'Capture the lead',
  job: 'Create the job',
  premAvailable: 'Check Prem availability',
  completePrem: 'Complete Prem',
  estimate: 'Build the estimate',
  approval: 'Get approval',
  schedule: 'Schedule the job',
  assign: 'Assign a tech',
  contact: 'Contact the customer',
  startWork: 'Start work',
  photos: 'Add photos',
  completeWork: 'Complete the work',
  paid: 'Collect payment',
  closeout: 'Close out the job',
  history: 'Review customer history',
};

export function deriveNextStep(states: StageResult[]): string {
  const red = states.find((s) => s.state === 'red');
  if (red) return `Next Steps: Redo ${STAGE_LABELS[red.key]}.`;
  const yellow = states.find((s) => s.state === 'yellow');
  if (yellow) return `Next Steps: Review ${STAGE_LABELS[yellow.key]}.`;
  const gray = states.find((s) => s.state === 'gray');
  if (gray) return `Next Steps: ${NEXT_PHRASE[gray.key]}.`;
  return 'Next Steps: All done.';
}
