/**
 * State-machine routing for the handoff page (Jobcore P5.S7a).
 *
 * `initialState` is the payer skip rule: a partner-paid job
 * (`payer !== 'customer'`) never sees `awaiting_payment` — it opens directly
 * at `review`, mirroring the same `job.payer !== 'customer'` skip
 * `app/modules/payment-review/src/index.ts`'s `buildTransitionCtx` applies
 * to `hasPaymentRecord`. `review`/`done` are unbuilt in this slice (S7b) —
 * this router only needs to know they are valid, reachable states.
 */

import type { HandoffJobData, HandoffState } from './types';

/** Determines which state the page opens at for a given job's payer. */
export function initialState(job: HandoffJobData): HandoffState {
  if (job.payer === 'partner') {
    return 'review';
  }
  return 'awaiting_payment';
}

/** Reads the raw handoff token out of the current URL (path segment after `/handoff/`, or `?token=`). */
export function readTokenFromLocation(location: Pick<Location, 'pathname' | 'search'>): string | null {
  const params = new URLSearchParams(location.search);
  const queryToken = params.get('token');
  if (queryToken) {
    return queryToken;
  }
  const segments = location.pathname.split('/').filter((s) => s.length > 0);
  const last = segments[segments.length - 1];
  return last && last !== 'handoff' ? last : null;
}
