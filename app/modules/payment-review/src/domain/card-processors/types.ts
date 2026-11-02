/**
 * CardProcessor contract: one slot that Stripe, Square or Helcim plugs into.
 *
 * The app picks exactly one processor (see `registry.ts`). Every adapter takes
 * the same request and returns the same result, so switching processors never
 * touches screen code. Card details are passed through once and never stored.
 */

/** Typed-in card details. Held in screen state only, cleared after the charge. */
export interface KeyedCard {
  number: string;
  cvc: string;
  zip: string;
  holder?: string;
}

export interface CardChargeRequest {
  jobId: string;
  amountCents: number;
  currency: string;
  /** Omitted for tap-to-pay, where the processor's own SDK reads the card. */
  card?: KeyedCard;
}

/**
 * approved: the processor took the money.
 * declined: the bank said no; `message` says why.
 * not_configured: no account or keys are set up for this processor yet.
 */
export type CardChargeResult =
  | { status: 'approved'; processorRef: string; last4: string }
  | { status: 'declined'; message: string }
  | { status: 'not_configured'; message: string };

export type CardProcessorId = 'none' | 'stripe' | 'square' | 'helcim';

export interface CardProcessor {
  id: CardProcessorId;
  displayName: string;
  capabilities: { keyedEntry: boolean; tapToPay: boolean };
  charge(request: CardChargeRequest): Promise<CardChargeResult>;
}
