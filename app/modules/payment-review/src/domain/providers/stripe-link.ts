/**
 * Stripe (hosted Checkout link) payment provider (Master Spec §14).
 *
 * Webhook-capable — `confirm` is a stub for now; real Stripe API wiring and
 * Edge Function webhook handling land in a later slice. This file is the
 * interface/plumbing layer only, no Stripe SDK call.
 */

import type { Job } from '@jobcore/core';
import type { HandoffAction, Money, PaymentProvider, PaymentStatus } from './types';

/** Config needed to construct a hosted Stripe Checkout link. */
export interface StripeLinkConfig {
  checkoutUrl: string;
}

export function buildStripeHandoffAction(
  job: Job,
  amount: Money,
  config: StripeLinkConfig
): HandoffAction {
  return {
    kind: 'link',
    url: config.checkoutUrl,
    label: `Pay by card — ${amount.amount} ${amount.currency}`,
  };
}

export const StripeLinkProvider: PaymentProvider = {
  id: 'stripe-link',
  displayName: 'Card (Stripe)',
  capabilities: { inApp: false, qrHandoff: true, webhookConfirm: true },
  async buildHandoffAction() {
    return null;
  },
  async confirm(ref: string): Promise<PaymentStatus> {
    // TODO: wire to Stripe API (retrieve PaymentIntent/Checkout Session by `ref`).
    return 'pending';
  },
};
