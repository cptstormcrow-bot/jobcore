/**
 * Entry point for the standalone handoff page (Jobcore P5.S7a).
 *
 * Reads the `handoff_token` out of the URL (`router.ts`), fetches the
 * job/provider data it resolves to (`api.ts`), picks the initial state
 * (partner-paid jobs skip straight to `review`), and renders the current
 * state's screen into `#app`. `review`/`done` render their S7b stub screens
 * only — see `screens/review.ts` / `screens/done.ts`.
 */

import { fetchHandoffJobData } from './api';
import { initialState, readTokenFromLocation } from './router';
import { renderAwaitingPayment } from './screens/awaitingPayment';
import { renderConfirming } from './screens/confirming';
import { renderDone } from './screens/done';
import { renderReview } from './screens/review';
import type { HandoffJobData, HandoffState } from './types';

function getAppContainer(): HTMLElement {
  const el = document.getElementById('app');
  if (!el) {
    throw new Error('main: #app container not found');
  }
  return el;
}

function renderError(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'error-box';
  box.textContent = message;
  container.appendChild(box);
}

function renderState(
  container: HTMLElement,
  state: HandoffState,
  token: string,
  job: HandoffJobData,
): void {
  switch (state) {
    case 'awaiting_payment':
      renderAwaitingPayment(container, {
        token,
        job,
        onAdvanceToConfirming: () => renderState(container, 'confirming', token, job),
        onError: (message) => renderError(container, message),
      });
      return;
    case 'confirming':
      renderConfirming(container);
      return;
    case 'review':
      renderReview(container, {
        token,
        job,
        onSubmitted: () => renderState(container, 'done', token, job),
        onError: (message) => renderError(container, message),
      });
      return;
    case 'done':
      renderDone(container);
      return;
  }
}

async function main(): Promise<void> {
  const container = getAppContainer();
  const token = readTokenFromLocation(window.location);

  if (!token) {
    renderError(container, 'Missing handoff token in the page URL.');
    return;
  }

  let job: HandoffJobData;
  try {
    job = await fetchHandoffJobData(token);
  } catch (err) {
    renderError(container, err instanceof Error ? err.message : 'Unable to load this handoff.');
    return;
  }

  renderState(container, initialState(job), token, job);
}

void main();
