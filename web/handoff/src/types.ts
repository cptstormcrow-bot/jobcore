/**
 * Types for the standalone handoff web page (Jobcore P5.S7a).
 *
 * Mirrors the shapes declared in
 * `app/modules/payment-review/src/domain/providers/types.ts` (`HandoffAction`,
 * `PaymentStatus`) and `app/modules/payment-review/src/domain/handoff.ts`
 * (the `issue_handoff_token` RPC this page's token comes from) — this page
 * has no build-time dependency on the `app/` workspace (it is not one of
 * `apps/*`/`packages/*`/`modules/*`), so the shapes it needs are restated
 * here rather than imported. Keep these in sync by hand if the source
 * shapes change.
 */

/** Mirrors `PaymentStatus` in `app/modules/payment-review/src/domain/providers/types.ts`. */
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'manual_confirmed';

/** Mirrors `HandoffAction` in `app/modules/payment-review/src/domain/providers/types.ts`. */
export interface HandoffAction {
  kind: 'qr' | 'link' | 'in_app';
  url?: string;
  label: string;
}

/**
 * A trimmed, page-facing view of `PaymentProvider` — no `buildHandoffAction`/
 * `confirm` functions cross the network boundary, only the data the page
 * needs to render a picker and know which providers are webhook-confirmable.
 */
export interface ProviderSummary {
  id: string;
  displayName: string;
  capabilities: { inApp: boolean; qrHandoff: boolean; webhookConfirm: boolean };
}

/** A monetary amount. Mirrors `Money` in providers/types.ts. */
export interface Money {
  amount: number;
  currency: string;
}

/**
 * The job/token payload this page fetches once it has the raw
 * `handoff_token` from the URL. `payer` drives the S7a routing/skip rule:
 * a partner-paid job never sees `awaiting_payment`.
 */
export interface HandoffJobData {
  jobId: string;
  payer: 'customer' | 'partner';
  amount: Money;
  providers: ProviderSummary[];
}

/** The 4-state machine this page walks. review/done are S7b stubs in this slice. */
export type HandoffState = 'awaiting_payment' | 'confirming' | 'review' | 'done';
