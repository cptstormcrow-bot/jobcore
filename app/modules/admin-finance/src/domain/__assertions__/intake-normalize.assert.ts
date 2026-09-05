/**
 * Assertions for `normalizeRawLead` (P7 Slice A).
 *
 * Runs under `node --experimental-strip-types --test` — zero setup: no DB,
 * no network, no env vars, no faked clock. Fixtures come straight from
 * `fixtures/raw-leads.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRawLead } from '../intake-normalize';
import {
  fullyStatedRawLead,
  barePartnerRawLead,
  partiallyStatedRawLead,
} from '../../fixtures/raw-leads';

test('fully stated raw lead: no axis fields assumed, not flagged for review', () => {
  const normalized = normalizeRawLead(fullyStatedRawLead, 'org-1');

  assert.deepEqual(normalized.assumedAxisFields, []);
  assert.equal(normalized.flaggedForReview, false);
  assert.equal(normalized.draft.source, 'google-ads');
  assert.equal(normalized.draft.payer, 'customer');
  assert.equal(normalized.draft.attachTiming, 'at_purchase');
  assert.equal(normalized.draft.organizationId, 'org-1');
  assert.equal(normalized.draft.name, fullyStatedRawLead.name);
});

test('bare partner raw lead: all three axis fields assumed, flagged for review', () => {
  const normalized = normalizeRawLead(barePartnerRawLead, 'org-1');

  assert.deepEqual(normalized.assumedAxisFields, ['source', 'payer', 'attachTiming']);
  assert.equal(normalized.flaggedForReview, true);
  assert.equal(normalized.draft.source, 'website');
  assert.equal(normalized.draft.payer, 'customer');
  assert.equal(normalized.draft.attachTiming, 'at_purchase');
});

test('partially stated raw lead: only payer assumed, flagged for review', () => {
  const normalized = normalizeRawLead(partiallyStatedRawLead, 'org-1');

  assert.deepEqual(normalized.assumedAxisFields, ['payer']);
  assert.equal(normalized.flaggedForReview, true);
  // Stated source ('costco') passes through uncoerced, distinguishable from the default.
  assert.equal(normalized.draft.source, 'costco');
  assert.equal(normalized.draft.payer, 'customer');
  assert.equal(normalized.draft.attachTiming, 'at_purchase');
});
