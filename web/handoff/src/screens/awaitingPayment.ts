/**
 * `awaiting_payment` screen (Jobcore P5.S7a).
 *
 * Shown only when the router has NOT skipped straight to `review` — i.e.
 * `job.payer === 'customer'`. Lists the job's enabled providers
 * (`HandoffJobData.providers`); picking one requests that provider's
 * `HandoffAction` and follows it: `link`/`qr` opens `action.url`, `in_app`
 * moves the page to `confirming` (there is nothing further this page can do
 * for an in-app flow — the mobile app takes over).
 */

import { requestHandoffAction } from '../api';
import type { HandoffJobData } from '../types';

export interface AwaitingPaymentDeps {
  token: string;
  job: HandoffJobData;
  onAdvanceToConfirming: () => void;
  onError: (message: string) => void;
}

export function renderAwaitingPayment(container: HTMLElement, deps: AwaitingPaymentDeps): void {
  const { token, job, onAdvanceToConfirming, onError } = deps;

  container.innerHTML = '';

  const badge = document.createElement('div');
  badge.className = 'state-badge';
  badge.textContent = 'Awaiting payment';
  container.appendChild(badge);

  const heading = document.createElement('h1');
  heading.textContent = `Pay ${job.amount.amount} ${job.amount.currency}`;
  container.appendChild(heading);

  const intro = document.createElement('p');
  intro.textContent = 'Choose how you would like to pay.';
  container.appendChild(intro);

  const list = document.createElement('div');
  list.className = 'provider-list';
  container.appendChild(list);

  for (const provider of job.providers) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'provider-button';
    button.textContent = provider.displayName;
    button.addEventListener('click', () => {
      void handleProviderSelected(token, provider.id, list, onAdvanceToConfirming, onError);
    });
    list.appendChild(button);
  }
}

async function handleProviderSelected(
  token: string,
  providerId: string,
  list: HTMLElement,
  onAdvanceToConfirming: () => void,
  onError: (message: string) => void,
): Promise<void> {
  list
    .querySelectorAll('button')
    .forEach((button) => button.setAttribute('disabled', 'true'));

  try {
    const action = await requestHandoffAction(token, providerId);
    followHandoffAction(action, onAdvanceToConfirming);
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Unable to start payment.');
  }
}

/** `qr`/`link` actions leave the page (open the handoff URL); `in_app` advances to `confirming`. */
function followHandoffAction(
  action: { kind: 'qr' | 'link' | 'in_app'; url?: string },
  onAdvanceToConfirming: () => void,
): void {
  if ((action.kind === 'qr' || action.kind === 'link') && action.url) {
    window.location.href = action.url;
    return;
  }
  onAdvanceToConfirming();
}
