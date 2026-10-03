/**
 * Pure Prems-card helpers (button action, report route, "needs Prem since"
 * date) kept free of `react-native` / `@jobcore/ui` / React imports so they
 * can be exercised under the plain-node assertion runner.
 */
import { format } from 'date-fns';
import type { PremQueueItem } from '../data/ports';

export type PremCardAction = 'Record' | 'Claim';

/** Button label for a Prems card: 'Record' once the signed-in tech has claimed it, else 'Claim'. */
export function premCardAction(claimedByMe: boolean): PremCardAction {
  return claimedByMe ? 'Record' : 'Claim';
}

/** Route that opens the job with the Prem report (Job Investigation) panel selected. */
export function premReportRoute(jobId: string): string {
  return '/job/' + jobId + '?panel=jobInvestigation';
}

/** "Needs Prem since" display date, or null when the job has no needsPremAt. */
export function formatNeedsPremSince(needsPremAt: PremQueueItem['job']['needsPremAt']): string | null {
  return needsPremAt ? format(new Date(needsPremAt), 'MMM d, yyyy') : null;
}
