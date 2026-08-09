/**
 * `confirming` screen (Jobcore P5.S7a).
 *
 * Plain-text explainer while a webhook or a tech's manual confirmation
 * settles the payment — deliberately no polling/spinner in this slice (no
 * infinite spinner); a later slice may add polling against
 * `fetchHandoffJobData` to auto-advance to `review` once settled.
 */

export function renderConfirming(container: HTMLElement): void {
  container.innerHTML = '';

  const badge = document.createElement('div');
  badge.className = 'state-badge';
  badge.textContent = 'Confirming payment';
  container.appendChild(badge);

  const heading = document.createElement('h1');
  heading.textContent = "You're almost done";
  container.appendChild(heading);

  const body = document.createElement('p');
  body.textContent =
    'We are waiting for your payment to be confirmed. This happens automatically once ' +
    'the payment settles, or your technician can confirm it manually. You can close this ' +
    'page — there is nothing more to do here right now.';
  container.appendChild(body);
}
