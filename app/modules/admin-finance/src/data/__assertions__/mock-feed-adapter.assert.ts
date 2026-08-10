/**
 * Assertions for `MockFeedAdapter` (P7 Slice A).
 *
 * Runs under `node --experimental-strip-types --test` — zero setup: no DB,
 * no network, no env vars, no faked clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MockFeedAdapter } from '../mock-feed-adapter';
import { mockFeedEntryFixtures, fullyStatedRawLead, barePartnerRawLead, partiallyStatedRawLead } from '../../fixtures/raw-leads';

test('MockFeedAdapter.fetchSince filters entries by occurredAt >= sinceIso (inclusive)', async () => {
  const adapter = new MockFeedAdapter(mockFeedEntryFixtures);

  const raw = await adapter.fetchSince('2026-08-05T14:30:00Z');

  assert.deepEqual(raw, [barePartnerRawLead, partiallyStatedRawLead]);
});

test('MockFeedAdapter.fetchSince returns every entry when sinceIso predates all of them', async () => {
  const adapter = new MockFeedAdapter(mockFeedEntryFixtures);

  const raw = await adapter.fetchSince('2000-01-01T00:00:00Z');

  assert.deepEqual(raw, [fullyStatedRawLead, barePartnerRawLead, partiallyStatedRawLead]);
});

test('MockFeedAdapter.fetchSince returns empty array when sinceIso is after every entry', async () => {
  const adapter = new MockFeedAdapter(mockFeedEntryFixtures);

  const raw = await adapter.fetchSince('2027-01-01T00:00:00Z');

  assert.deepEqual(raw, []);
});

test('MockFeedAdapter carries a fixed id', () => {
  const adapter = new MockFeedAdapter(mockFeedEntryFixtures);

  assert.equal(adapter.id, 'mock-feed');
});
