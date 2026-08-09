/**
 * P2P (Venmo / CashApp / Zelle) payment provider (Master Spec §14).
 *
 * Not webhook-capable — a tech confirms receipt in person, so this provider
 * has no `confirm` method. `buildHandoffAction` builds a deep-link/URL from
 * an org-configured handle, passed in as a plain config param (no DB call
 * here — resolving the org's handle is the caller's job).
 */

import type { Job } from '@jobcore/core';
import type { HandoffAction, Money, PaymentProvider } from './types';

/** Org-configured P2P handle used to build the deep link. */
export interface P2PLinkConfig {
  handle: string;
  url: string;
}

export function buildP2PHandoffAction(
  job: Job,
  amount: Money,
  config: P2PLinkConfig
): HandoffAction {
  return {
    kind: 'link',
    url: config.url,
    label: `Pay ${config.handle} — ${amount.amount} ${amount.currency}`,
  };
}

/**
 * Factory: builds a P2PLinkProvider bound to a specific org's handle config.
 * The bare `P2PLinkProvider` export below has no config bound and always
 * returns null — callers needing a real handoff should use this factory.
 */
export function createP2PLinkProvider(config: P2PLinkConfig): PaymentProvider {
  return {
    id: 'p2p-link',
    displayName: 'Venmo / CashApp / Zelle',
    capabilities: { inApp: false, qrHandoff: true, webhookConfirm: false },
    async buildHandoffAction(job: Job, amount: Money) {
      return buildP2PHandoffAction(job, amount, config);
    },
  };
}

export const P2PLinkProvider: PaymentProvider = {
  id: 'p2p-link',
  displayName: 'Venmo / CashApp / Zelle',
  capabilities: { inApp: false, qrHandoff: true, webhookConfirm: false },
  async buildHandoffAction() {
    return null;
  },
};
