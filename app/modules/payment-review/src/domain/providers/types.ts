/**
 * PaymentProvider contract (Master Spec §14), verbatim shape.
 *
 * `Job` is imported from `@jobcore/core` (already defined there). `Money`
 * does not exist in `@jobcore/core` yet, so it is defined locally alongside
 * `HandoffAction` and `PaymentStatus` — all three are new to P5.
 *
 * `PaymentStatus` mirrors the `payments.status` check constraint exactly
 * (supabase/0010_payment_review.sql): 'pending' | 'confirmed' | 'failed' |
 * 'manual_confirmed'. Any future status value is added there first.
 */

import type { Job } from '@jobcore/core';

/** A monetary amount. Minor-unit-free for now — a later slice may tighten this to integer cents. */
export interface Money {
  amount: number;
  currency: string;
}

/**
 * Mirrors the Postgres `payments.status` check constraint
 * (supabase/0010_payment_review.sql, `payments_status_check`).
 */
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'manual_confirmed';

/**
 * The action a provider hands back to drive the customer through payment —
 * e.g. a QR/link handoff for a hosted flow, or an in-app confirmation step.
 * Shape kept minimal (S2 scaffolding); a later slice may add provider-specific
 * fields.
 */
export interface HandoffAction {
  kind: 'qr' | 'link' | 'in_app';
  url?: string;
  label: string;
}

/**
 * A payment provider integration a module (or org) may enable. Providers
 * that cannot receive a webhook confirmation (capabilities.webhookConfirm
 * === false) omit `confirm`.
 */
export interface PaymentProvider {
  id: string;
  displayName: string;
  capabilities: { inApp: boolean; qrHandoff: boolean; webhookConfirm: boolean };
  buildHandoffAction(job: Job, amount: Money): Promise<HandoffAction | null>;
  confirm?(ref: string): Promise<PaymentStatus>; // webhook-capable providers only
}
