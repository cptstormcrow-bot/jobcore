/**
 * The three processor adapters plus the manual fallback.
 *
 * Stripe, Square and Helcim are stubs: each answers `not_configured` until its
 * account and keys exist. Wiring one up means filling in its `charge` (via a
 * Supabase Edge Function that holds the secret key) and nothing else.
 */

import type { CardProcessor } from './types';

const notConfigured = (name: string) =>
  async () => ({ status: 'not_configured' as const, message: `${name} is not set up yet.` });

/**
 * No processor: the card is checked on screen (checksum, CVC, zip) and the
 * payment is recorded by hand, as before. Nothing is sent anywhere.
 */
export const ManualCardProcessor: CardProcessor = {
  id: 'none',
  displayName: 'Manual (no processor)',
  capabilities: { keyedEntry: true, tapToPay: false },
  async charge(request) {
    return { status: 'approved', processorRef: 'manual', last4: request.card?.number.slice(-4) ?? '' };
  },
};

export const StripeCardProcessor: CardProcessor = {
  id: 'stripe',
  displayName: 'Stripe',
  capabilities: { keyedEntry: true, tapToPay: true },
  // TODO: create a PaymentIntent in an Edge Function; collect the card with the Stripe RN SDK.
  charge: notConfigured('Stripe'),
};

export const SquareCardProcessor: CardProcessor = {
  id: 'square',
  displayName: 'Square',
  capabilities: { keyedEntry: true, tapToPay: true },
  // TODO: Square In-App Payments SDK nonce, then CreatePayment from an Edge Function.
  charge: notConfigured('Square'),
};

export const HelcimCardProcessor: CardProcessor = {
  id: 'helcim',
  displayName: 'Helcim',
  capabilities: { keyedEntry: true, tapToPay: false },
  // TODO: HelcimPay.js checkout token, then the purchase call from an Edge Function.
  charge: notConfigured('Helcim'),
};
