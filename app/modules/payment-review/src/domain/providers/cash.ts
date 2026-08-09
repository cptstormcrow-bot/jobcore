/**
 * Cash payment provider (Master Spec §14).
 *
 * Not webhook-capable — a tech confirms receipt in person, so this provider
 * has no `confirm` method and `buildHandoffAction` returns null (no
 * customer-facing handoff to drive). The resulting `manual_confirmed` status
 * and `confirmed_by` are set elsewhere, in the tech-confirm UI flow.
 */

import type { PaymentProvider } from './types';

export const CashProvider: PaymentProvider = {
  id: 'cash',
  displayName: 'Cash',
  capabilities: { inApp: false, qrHandoff: false, webhookConfirm: false },
  async buildHandoffAction() {
    return null;
  },
};
