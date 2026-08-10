/**
 * Assertions for `toPriceSheetFeedDocument` (P7 Slice A).
 *
 * Runs under `node --experimental-strip-types --test` — zero setup: no DB,
 * no network, no env vars, no faked clock. Fixtures come straight from
 * `fixtures/price-sheet.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { toPriceSheetFeedDocument } from '../price-sheet-feed';
import {
  publishedPriceSheet,
  draftPriceSheet,
  publishedPriceSheetRates,
  serviceNameFixture,
  rateWithUnknownService,
} from '../../fixtures/price-sheet';

test('toPriceSheetFeedDocument succeeds for a published sheet with fully named rates', () => {
  const result = toPriceSheetFeedDocument(publishedPriceSheet, publishedPriceSheetRates, serviceNameFixture);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.priceSheetId, publishedPriceSheet.id);
  assert.equal(result.value.organizationId, publishedPriceSheet.organizationId);
  assert.equal(result.value.version, publishedPriceSheet.version);
  assert.equal(result.value.publishedAt, publishedPriceSheet.publishedAt);
  assert.equal(result.value.rows.length, 2);
  assert.deepEqual(result.value.rows[0], {
    serviceId: 'service-trampoline',
    serviceName: 'Trampoline Assembly',
    attachTiming: 'at_purchase',
    amount: 12500,
  });
});

test('toPriceSheetFeedDocument fails closed when the sheet is not published', () => {
  const result = toPriceSheetFeedDocument(draftPriceSheet, publishedPriceSheetRates, serviceNameFixture);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /is not published/);
});

test('toPriceSheetFeedDocument fails closed when a rate references an unknown service', () => {
  const result = toPriceSheetFeedDocument(
    publishedPriceSheet,
    [rateWithUnknownService],
    serviceNameFixture,
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /No service name found for service service-unknown/);
});

test('toPriceSheetFeedDocument succeeds with an empty rate list on a published sheet', () => {
  const result = toPriceSheetFeedDocument(publishedPriceSheet, [], serviceNameFixture);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.rows, []);
});
