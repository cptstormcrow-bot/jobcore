/**
 * Fixed-literal `PriceSheet`/`PriceSheetRate`/service-name fixtures for
 * P7 Slice A's `price-sheet-feed.ts` tests. No `Date.now()` — `publishedAt`
 * is a literal string, matching `fixtures/leads.ts`'s "zero setup"
 * discipline.
 */

import type { PriceSheet, PriceSheetRate } from '../money/types';

/** A published price sheet — the only status `toPriceSheetFeedDocument` accepts. */
export const publishedPriceSheet: PriceSheet = {
  id: 'price-sheet-published-1',
  organizationId: 'org-1',
  version: 3,
  status: 'published',
  publishedAt: '2026-07-01T00:00:00Z',
};

/** A draft price sheet — used to prove `toPriceSheetFeedDocument` fails closed on a non-published sheet. */
export const draftPriceSheet: PriceSheet = {
  id: 'price-sheet-draft-1',
  organizationId: 'org-1',
  version: 4,
  status: 'draft',
  publishedAt: null,
};

/** Rates belonging to `publishedPriceSheet`. */
export const publishedPriceSheetRates: readonly PriceSheetRate[] = [
  {
    id: 'rate-1',
    priceSheetId: publishedPriceSheet.id,
    serviceId: 'service-trampoline',
    attachTiming: 'at_purchase',
    amount: 12500,
  },
  {
    id: 'rate-2',
    priceSheetId: publishedPriceSheet.id,
    serviceId: 'service-shed',
    attachTiming: 'post_purchase',
    amount: 22000,
  },
];

/** `serviceId -> name` map covering every service referenced by `publishedPriceSheetRates`. */
export const serviceNameFixture: ReadonlyMap<string, string> = new Map([
  ['service-trampoline', 'Trampoline Assembly'],
  ['service-shed', 'Shed Assembly'],
]);

/** A rate referencing a `serviceId` absent from `serviceNameFixture` — used to prove the missing-name failure path. */
export const rateWithUnknownService: PriceSheetRate = {
  id: 'rate-unknown',
  priceSheetId: publishedPriceSheet.id,
  serviceId: 'service-unknown',
  attachTiming: 'at_purchase',
  amount: 5000,
};
