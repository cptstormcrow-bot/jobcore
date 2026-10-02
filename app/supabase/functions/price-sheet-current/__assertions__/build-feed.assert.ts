/**
 * Assertions for the price-sheet-current public feed's pure buildFeed()
 * (Slice 3 item 1).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no Deno import.
 * Fixture data only, mirroring price_sheets / price_sheet_rates row shapes
 * from supabase/migrations/0005_money.sql.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { PriceSheetRow, PriceSheetRateRow } from '../handler.ts';
import { buildFeed } from '../handler.ts';

function makeSheet(overrides: Partial<PriceSheetRow> = {}): PriceSheetRow {
  return {
    id: 'sheet-1',
    organization_id: 'org-1',
    version: 3,
    effective_from: '2026-08-01',
    published_at: '2026-08-01T12:00:00.000Z',
    status: 'published',
    ...overrides,
  };
}

function makeRate(overrides: Partial<PriceSheetRateRow> = {}): PriceSheetRateRow {
  return {
    price_sheet_id: 'sheet-1',
    service_id: 'service-1',
    attach_timing: 'at_purchase',
    amount_cents: 5000,
    ...overrides,
  };
}

test('AC: a published sheet maps to the correct FeedBody', () => {
  const sheet = makeSheet();
  const rate = makeRate();

  const feed = buildFeed([sheet], [rate]);
  assert.ok(feed);
  assert.equal(feed?.organization_id, 'org-1');
  assert.equal(feed?.version, 3);
  assert.equal(feed?.effective_from, '2026-08-01');
  assert.equal(feed?.published_at, '2026-08-01T12:00:00.000Z');
  assert.deepEqual(feed?.rates, [
    { service_id: 'service-1', task_id: null, attach_timing: 'at_purchase', amount_cents: 5000 },
  ]);
});

test('AC: an unpublished/draft sheet is excluded, no rates returned', () => {
  const draftSheet = makeSheet({ id: 'sheet-2', status: 'draft', published_at: null });
  const rate = makeRate({ price_sheet_id: 'sheet-2' });

  const feed = buildFeed([draftSheet], [rate]);
  assert.equal(feed, null);
});

test('AC: a superseded sheet is excluded even when a published sheet coexists', () => {
  const superseded = makeSheet({ id: 'sheet-1', version: 2, status: 'superseded' });
  const published = makeSheet({ id: 'sheet-3', version: 3, status: 'published' });
  const oldRate = makeRate({ price_sheet_id: 'sheet-1', service_id: 'service-old' });
  const newRate = makeRate({ price_sheet_id: 'sheet-3', service_id: 'service-new' });

  const feed = buildFeed([superseded, published], [oldRate, newRate]);
  assert.ok(feed);
  assert.equal(feed?.organization_id, published.organization_id);
  assert.deepEqual(feed?.rates, [
    { service_id: 'service-new', task_id: null, attach_timing: 'at_purchase', amount_cents: 5000 },
  ]);
});

test('AC: multiple rates on the published sheet all map correctly', () => {
  const sheet = makeSheet();
  const rates = [
    makeRate({ service_id: 'service-a', attach_timing: 'at_purchase', amount_cents: 1000 }),
    makeRate({ service_id: 'service-b', attach_timing: 'after_the_fact', amount_cents: 2500 }),
    makeRate({ service_id: 'service-c', attach_timing: null, amount_cents: 750 }),
  ];

  const feed = buildFeed([sheet], rates);
  assert.ok(feed);
  assert.equal(feed?.rates.length, 3);
  assert.deepEqual(feed?.rates, [
    { service_id: 'service-a', task_id: null, attach_timing: 'at_purchase', amount_cents: 1000 },
    { service_id: 'service-b', task_id: null, attach_timing: 'after_the_fact', amount_cents: 2500 },
    { service_id: 'service-c', task_id: null, attach_timing: null, amount_cents: 750 },
  ]);
});

test('AC: a task-level rate carries its task_id through to the feed', () => {
  const sheet = makeSheet();
  const rate = makeRate({ task_id: 'task-a' });

  const feed = buildFeed([sheet], [rate]);
  assert.ok(feed);
  assert.equal(feed?.rates[0].task_id, 'task-a');
});
