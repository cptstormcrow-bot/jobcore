// Pure derivation of the 11-stage job progress bar and its "Next Steps" sentence. No I/O.

export const STAGE_KEYS = [
  'job', 'prem', 'estimate', 'approval', 'schedule', 'assign',
  'contact', 'startWork', 'completeWork', 'paid', 'closeout',
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  job: 'Job',
  prem: 'Prem',
  estimate: 'Estimate',
  approval: 'Approval',
  schedule: 'Schedule',
  assign: 'Assign',
  contact: 'Contact',
  startWork: 'Start',
  completeWork: 'Complete',
  paid: 'Paid',
  closeout: 'Closeout',
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
  /** True when a complete stage must stay green once done: skips the "earlier stage changed after completion" yellow downgrade. `missingRequired` and `rejected` still apply. */
  sticky?: boolean;
  /** True when the stage does not apply to this job: while incomplete it reads gray instead of red (an `inProgress` stage is still yellow). */
  notRequired?: boolean;
}

export type StageInputs = Record<StageKey, StageInput>;

export interface StageResult {
  key: StageKey;
  state: StageState;
  doneAt: string | null;
  /** True when the stage is gray because it does not apply and a later stage is already complete; `deriveNextStep` skips it. */
  notRequired?: boolean;
  /** Why a yellow stage needs review: an earlier stage changed after it was done, required info is missing, or it is under way. */
  reason?: YellowReason;
  /** With reason 'changed': the first earlier stage that changed after this one was completed. */
  changedBy?: StageKey;
}

export type YellowReason = 'changed' | 'missing' | 'inProgress';

export function deriveStageStates(inputs: StageInputs): StageResult[] {
  return STAGE_KEYS.map((key, i) => {
    const cur = inputs[key];
    let state: StageState;
    let skipped = false;
    let reason: YellowReason | undefined;
    let changedBy: StageKey | undefined;
    if (cur.rejected) {
      state = 'red';
    } else if (cur.complete) {
      state = 'green';
      if (cur.missingRequired) { state = 'yellow'; reason = 'missing'; }
      else if (cur.completedAt && !cur.sticky) {
        // Yellow when any earlier stage changed after this one was completed.
        for (let j = 0; j < i; j++) {
          const prev = STAGE_KEYS[j]; if (!prev) continue; const changed = inputs[prev].changedAt;
          if (changed && Date.parse(changed) > Date.parse(cur.completedAt)) {
            state = 'yellow';
            reason = 'changed';
            changedBy = prev;
            break;
          }
        }
      }
    } else if (cur.inProgress) {
      state = 'yellow';
      reason = 'inProgress';
    } else {
      // Gray and skipped when the stage does not apply; otherwise red when a later stage is already complete.
      const laterDone = STAGE_KEYS.slice(i + 1).some((k) => inputs[k].complete);
      if (cur.notRequired) { state = 'gray'; skipped = true; }
      else state = laterDone ? 'red' : 'gray';
    }
    return {
      key, state, doneAt: cur.complete && !cur.rejected ? cur.completedAt ?? null : null,
      ...(skipped ? { notRequired: true } : {}),
      ...(reason ? { reason } : {}),
      ...(changedBy ? { changedBy } : {}),
    };
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
  job: 'Create the job',
  prem: 'Complete Prem',
  estimate: 'Build the estimate',
  approval: 'Get approval',
  schedule: 'Schedule the job',
  assign: 'Assign a tech',
  contact: 'Contact the customer',
  startWork: 'Start work',
  completeWork: 'Complete the work',
  paid: 'Collect payment',
  closeout: 'Close out the job',
};

/** Short reason a yellow stage needs review, e.g. "Estimate changed"; empty when none is known. */
export function yellowReasonText(s: StageResult): string {
  if (s.reason === 'changed' && s.changedBy) return `${STAGE_LABELS[s.changedBy]} changed`;
  if (s.reason === 'missing') return 'info missing';
  if (s.reason === 'inProgress') return 'in progress';
  return '';
}

/** Why a stage cannot move yet, keyed by stage, e.g. `{ startWork: 'needs an installer tech' }`. */
export type StageBlockers = Partial<Record<StageKey, string>>;

/** The next-step line; when the chosen stage is blocked, the roadblock replaces the generic phrase (Jeff 2026-11-02). */
export function deriveNextStep(states: StageResult[], blockers: StageBlockers = {}): string {
  const red = states.find((s) => s.state === 'red');
  if (red) {
    const block = blockers[red.key];
    return block ? `Next Steps: Redo ${STAGE_LABELS[red.key]}: ${block}.` : `Next Steps: Redo ${STAGE_LABELS[red.key]}.`;
  }
  const yellow = states.find((s) => s.state === 'yellow');
  if (yellow) {
    const why = yellowReasonText(yellow);
    return `Next Steps: Review ${STAGE_LABELS[yellow.key]}${why ? ` (${why})` : ''}.`;
  }
  const gray = states.find((s) => s.state === 'gray' && !s.notRequired);
  if (gray) {
    const block = blockers[gray.key];
    return block ? `Next Steps: ${NEXT_PHRASE[gray.key]}: ${block}.` : `Next Steps: ${NEXT_PHRASE[gray.key]}.`;
  }
  return 'Next Steps: All done.';
}
