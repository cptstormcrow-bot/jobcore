/**
 * PayPal payment provider (Master Spec §14).
 *
 * Webhook-capable — `confirm` is a stub for now; real PayPal API wiring and
 * Edge Function webhook handling land in a later slice. This file is the
 * interface/plumbing layer only, no PayPal SDK call.
 */

import type { Job } from '@jobcore/core';
import type { HandoffAction, Money, PaymentProvider, PaymentStatus } from './types';

/** Config needed to construct a hosted PayPal checkout link. */
export interface PayPalConfig {
  checkoutUrl: string;
}

export function buildPayPalHandoffAction(
  job: Job,
  amount: Money,
  config: PayPalConfig
): HandoffAction {
  return {
    kind: 'link',
    url: config.checkoutUrl,
    label: `Pay via PayPal — ${amount.amount} ${amount.currency}`,
  };
}

export const PayPalProvider: PaymentProvider = {
  id: 'paypal',
  displayName: 'PayPal',
  capabilities: { inApp: false, qrHandoff: true, webhookConfirm: true },
  async buildHandoffAction() {
    return null;
  },
  async confirm(ref: string): Promise<PaymentStatus> {
    // TODO: wire to PayPal API (retrieve order/capture status by `ref`).
    return 'pending';
  },
};
