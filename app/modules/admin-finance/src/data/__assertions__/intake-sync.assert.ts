/**
 * Assertions for `runIntakeSync` (P7 Slice A).
 *
 * Proves adapter-swap transparency (`ManualEntryAdapter` vs `MockFeedAdapter`
 * behind the same `runIntakeSync` call produce equivalent shapes) and proves
 * axis-defaulted leads are correctly flagged for review. Runs under
 * `node --experimental-strip-types --test` — zero setup: no DB, no network,
 * no env vars, no faked clock. The fake repository below satisfies exactly
 * `Pick<LeadRepository, 'create'>`, matching `runIntakeSync`'s narrowed
 * parameter type.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { runIntakeSync } from '../intake-sync';
import { ManualEntryAdapter, InMemoryManualLeadStore } from '../manual-entry-adapter';
import { MockFeedAdapter } from '../mock-feed-adapter';
import type { LeadRepository } from '../ports';
import type { Lead } from '../../domain/lead';
import type { NewLeadDraft } from '../../domain/intake-normalize';
import { fullyStatedRawLead, barePartnerRawLead, mockFeedEntryFixtures } from '../../fixtures/raw-leads';

function makeFakeLeadRepository(): { create: Pick<LeadRepository, 'create'>['create']; created: NewLeadDraft[] } {
  const created: NewLeadDraft[] = [];
  let nextId = 1;
  const create = async (draft: NewLeadDraft): Promise<Lead> => {
    created.push(draft);
    const lead: Lead = {
      id: `lead-${nextId++}`,
      organizationId: draft.organizationId,
      sourceForm: draft.sourceForm,
      name: draft.name,
      phone: draft.phone,
      email: draft.email,
      service: draft.service,
      preferredDate: draft.preferredDate,
      preferredTime: draft.preferredTime,
      address: draft.address,
      projectDetails: draft.projectDetails,
      source: draft.source,
      payer: draft.payer,
      attachTiming: draft.attachTiming,
      qualifiedAt: null,
      convertedJobId: null,
      createdAt: '2026-08-10T00:00:00Z',
    };
    return lead;
  };
  return { create, created };
}

test('runIntakeSync flags axis-defaulted leads for review and leaves fully stated leads unflagged', async () => {
  const adapter = new ManualEntryAdapter(new InMemoryManualLeadStore());
  adapter.submit(fullyStatedRawLead, '2026-08-01T00:00:00Z');
  adapter.submit(barePartnerRawLead, '2026-08-02T00:00:00Z');
  const repo = makeFakeLeadRepository();

  const result = await runIntakeSync(adapter, repo, 'org-1', '2026-08-01T00:00:00Z');

  assert.equal(result.adapterId, 'manual-entry');
  assert.equal(result.created.length, 2);
  assert.equal(result.flaggedForReview.length, 1);
  const [flagged] = result.flaggedForReview;
  assert.ok(flagged);
  assert.equal(flagged.lead.name, barePartnerRawLead.name);
  assert.equal(repo.created.length, 2);
  assert.equal(repo.created.every((draft) => draft.organizationId === 'org-1'), true);
});

test('runIntakeSync produces the same result shape when the adapter is swapped for MockFeedAdapter', async () => {
  const adapter = new MockFeedAdapter(mockFeedEntryFixtures);
  const repo = makeFakeLeadRepository();

  const result = await runIntakeSync(adapter, repo, 'org-1', '2020-01-01T00:00:00Z');

  assert.equal(result.adapterId, 'mock-feed');
  assert.equal(result.created.length, mockFeedEntryFixtures.length);
  // barePartnerRawLead and partiallyStatedRawLead each miss axis fields -> 2 flagged.
  assert.equal(result.flaggedForReview.length, 2);
  const [firstCreated] = result.created;
  assert.ok(firstCreated && 'lead' in firstCreated && 'flaggedForReview' in firstCreated);
});

test('runIntakeSync returns an empty result when the adapter has nothing new since the cursor', async () => {
  const adapter = new ManualEntryAdapter(new InMemoryManualLeadStore());
  const repo = makeFakeLeadRepository();

  const result = await runIntakeSync(adapter, repo, 'org-1', '2026-08-01T00:00:00Z');

  assert.deepEqual(result.created, []);
  assert.deepEqual(result.flaggedForReview, []);
  assert.equal(repo.created.length, 0);
});
