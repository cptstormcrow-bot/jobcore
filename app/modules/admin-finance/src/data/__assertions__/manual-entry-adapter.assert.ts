/**
 * Assertions for `InMemoryManualLeadStore` and `ManualEntryAdapter` (P7 Slice A).
 *
 * Runs under `node --experimental-strip-types --test` — zero setup: no DB,
 * no network, no env vars, no faked clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryManualLeadStore, ManualEntryAdapter } from '../manual-entry-adapter';
import { fullyStatedRawLead, barePartnerRawLead, partiallyStatedRawLead } from '../../fixtures/raw-leads';

test('InMemoryManualLeadStore.listSince filters by sinceIso (inclusive)', () => {
  const store = new InMemoryManualLeadStore();
  store.submit(fullyStatedRawLead, '2026-08-01T00:00:00Z');
  store.submit(barePartnerRawLead, '2026-08-05T00:00:00Z');
  store.submit(partiallyStatedRawLead, '2026-08-10T00:00:00Z');

  const since = store.listSince('2026-08-05T00:00:00Z');

  assert.equal(since.length, 2);
  assert.deepEqual(
    since.map((entry) => entry.lead),
    [barePartnerRawLead, partiallyStatedRawLead],
  );
});

test('InMemoryManualLeadStore.listSince returns everything when sinceIso predates all entries', () => {
  const store = new InMemoryManualLeadStore();
  store.submit(fullyStatedRawLead, '2026-08-01T00:00:00Z');

  const since = store.listSince('2020-01-01T00:00:00Z');

  assert.equal(since.length, 1);
});

test('ManualEntryAdapter.submit + fetchSince round-trips through the store', async () => {
  const adapter = new ManualEntryAdapter(new InMemoryManualLeadStore());
  adapter.submit(fullyStatedRawLead, '2026-08-01T00:00:00Z');
  adapter.submit(barePartnerRawLead, '2026-08-06T00:00:00Z');

  const raw = await adapter.fetchSince('2026-08-06T00:00:00Z');

  assert.deepEqual(raw, [barePartnerRawLead]);
  assert.equal(adapter.id, 'manual-entry');
});

test('ManualEntryAdapter.fetchSince returns empty array when nothing was submitted', async () => {
  const adapter = new ManualEntryAdapter(new InMemoryManualLeadStore());

  const raw = await adapter.fetchSince('2020-01-01T00:00:00Z');

  assert.deepEqual(raw, []);
});
