/**
 * Pure Completion-screen decisions (the 7-item Job Checklist definition, submit
 * gate, upstairs-fee rule, time-spent formatting, completion note body, and the
 * "can this job be completed" notice) kept free of React / `react-native` /
 * `@jobcore/*` imports so they can be exercised under the plain-node assertion
 * runner. Imported by Completion.tsx, the job screen's handleComplete, and the
 * route app/job/complete/[jobId].tsx.
 */

/** Flat fee added to the Estimate when materials were NOT moved upstairs. */
export const UPSTAIRS_FEE = 20;
/** Line-item description of that fee; also the de-duplication key. */
export const UPSTAIRS_FEE_DESCRIPTION = 'Materials not moved upstairs fee';

export type CompletionItemKey =
  | 'materialsOnsite'
  | 'movedUpstairs'
  | 'damage'
  | 'extraScope'
  | 'buildsFinished'
  | 'debrisCleared'
  | 'photosTaken';

export interface CompletionChecklistItem {
  key: CompletionItemKey;
  label: string;
  hint?: string;
}

/** Display order top to bottom. Labels are Jeff's exact words. */
export const COMPLETION_CHECKLIST_ITEMS: readonly CompletionChecklistItem[] = [
  { key: 'materialsOnsite', label: 'Materials onsite and complete?' },
  { key: 'movedUpstairs', label: 'Materials moved upstairs', hint: '$20 fee if not done' },
  { key: 'damage', label: 'List any apparent damage to the box(es) or unpacked items before assembly' },
  { key: 'extraScope', label: 'Additional items added to scope after arrival?' },
  { key: 'buildsFinished', label: 'Build(s) finish successfully' },
  { key: 'debrisCleared', label: 'Worksite debris cleared/packed' },
  { key: 'photosTaken', label: 'Photographs taken' },
];

export interface CompletionGateInput {
  buildsFinished: boolean;
  debrisCleared: boolean;
  afterPhotoCount: number;
  notes: string; // Quality notes
  submitting: boolean;
  damageChecked?: boolean;
  damageText?: string; // item 3: when ticked, text is required
  scopeChecked?: boolean;
  scopeText?: string; // item 4: when ticked, text is required
}

/** Submit gate: builds finished, debris cleared, not submitting, ticked detail items have text. After-photos and quality notes are optional. */
export function canSubmitCompletion(input: CompletionGateInput): boolean {
  const damageOk = !input.damageChecked || (input.damageText ?? '').trim() !== '';
  const scopeOk = !input.scopeChecked || (input.scopeText ?? '').trim() !== '';
  return (
    input.buildsFinished &&
    input.debrisCleared &&
    !input.submitting &&
    damageOk &&
    scopeOk
  );
}

/** true when the $20 fee applies, i.e. movedUpstairs === false. */
export function upstairsFeeApplies(movedUpstairs: boolean): boolean {
  return movedUpstairs === false;
}

/** 'Xh Ym' from whole seconds (floor to minutes); null/undefined/non-finite/negative -> '--'. */
export function formatTimeSpent(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '--';
  const totalMinutes = Math.floor(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

export interface CompletionNoteInput {
  materialsOnsite: boolean;
  movedUpstairs: boolean;
  damageChecked: boolean;
  damageText: string;
  scopeChecked: boolean;
  scopeText: string;
  buildsFinished: boolean;
  debrisCleared: boolean;
  afterPhotoCount: number;
  timeSpentSeconds: number | null;
  feeApplied: boolean; // whether the $20 fee line is/was added
}

/** Readable plain-text body for the job_notes row (kind 'completion_checklist'). Deterministic. */
export function buildCompletionNoteBody(input: CompletionNoteInput): string {
  const labelOf = (key: CompletionItemKey): string =>
    COMPLETION_CHECKLIST_ITEMS.find((i) => i.key === key)?.label ?? key;
  const mark = (on: boolean): string => (on ? '[x]' : '[ ]');
  const withText = (on: boolean, text: string): string => {
    const t = text.trim();
    return on && t !== '' ? ` - ${t}` : '';
  };
  const n = input.afterPhotoCount;
  const lines = [
    `${mark(input.materialsOnsite)} ${labelOf('materialsOnsite')}`,
    `${mark(input.movedUpstairs)} ${labelOf('movedUpstairs')}`,
    `${mark(input.damageChecked)} ${labelOf('damage')}${withText(input.damageChecked, input.damageText)}`,
    `${mark(input.scopeChecked)} ${labelOf('extraScope')}${withText(input.scopeChecked, input.scopeText)}`,
    `${mark(input.buildsFinished)} ${labelOf('buildsFinished')}`,
    `${mark(input.debrisCleared)} ${labelOf('debrisCleared')}`,
    `${mark(n >= 1)} ${labelOf('photosTaken')} (${n} ${n === 1 ? 'photo' : 'photos'})`,
    '',
    `Time spent: ${formatTimeSpent(input.timeSpentSeconds)}`,
    input.feeApplied ? `Upstairs fee: $${UPSTAIRS_FEE.toFixed(2)} added` : 'Upstairs fee: none',
  ];
  return lines.join('\n');
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

/** true when the job is already complete (completedAt set, or status at/after completed). */
export function isAlreadyComplete(job: CompletionBlockInput): boolean {
  const completedSet = job.completedAt !== undefined && job.completedAt !== null && job.completedAt !== '';
  return completedSet || PAST_COMPLETION.includes(job.status);
}

/** Plain-language reason a job cannot be completed, or null when it can. */
export function completionBlockedNotice(job: CompletionBlockInput): string | null {
  if (isAlreadyComplete(job)) return MSG_ALREADY_COMPLETE;
  if (job.status === 'cancelled') return MSG_CANCELLED;
  if (job.status !== 'in_progress') return MSG_NOT_STARTED;
  return null;
}
