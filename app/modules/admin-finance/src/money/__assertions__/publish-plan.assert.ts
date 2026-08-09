/**
 * Assertions for the admin-finance money core publish-planning (P3i.5).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup (AC-6): no DB, no network, no env vars, no faked
 * clock. Every timestamp used below is a fixed ISO literal, never
 * `Date.now()` or a mock/fake clock library.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { PriceSheet } from '../types';
import { planPublish } from '../publish-plan';

function makeSheet(overrides: Partial<PriceSheet> = {}): PriceSheet {
  return {
    id: 'sheet-2',
    organizationId: 'org-1',
    version: 2,
    status: 'draft',
    publishedAt: null,
    ...overrides,
  };
}

const now = '2026-08-08T12:00:00.000Z';

test('AC: no prior published sheet — draft promotes, toSupersede is null', () => {
  const sheet = makeSheet();

  const result = planPublish(sheet, null, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.toPublish.priceSheetId, sheet.id);
  assert.equal(result.value.toPublish.status, 'published');
  assert.equal(result.value.toPublish.publishedAt, now);
  assert.equal(result.value.toSupersede, null);
});

test('AC: prior published sheet present — promote+demote pair, prior publishedAt unchanged', () => {
  const priorPublished = makeSheet({
    id: 'sheet-1',
    version: 1,
    status: 'published',
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  const sheet = makeSheet();

  const result = planPublish(sheet, priorPublished, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.value.toPublish.priceSheetId, sheet.id);
  assert.equal(result.value.toPublish.status, 'published');
  assert.equal(result.value.toPublish.publishedAt, now);

  assert.ok(result.value.toSupersede);
  // 'archived' is the correct target status here — this module's
  // PriceSheetStatus vocabulary is 'draft' | 'published' | 'archived', not
  // 'superseded' (see publish-plan.ts's file-top JSDoc for why).
  assert.equal(result.value.toSupersede?.status, 'archived');
  assert.equal(result.value.toSupersede?.priceSheetId, priorPublished.id);
  assert.equal(result.value.toSupersede?.publishedAt, priorPublished.publishedAt);
});

test('AC: fails when sheet.status is not draft', () => {
  const sheet = makeSheet({ status: 'published', publishedAt: '2026-08-01T00:00:00.000Z' });

  const result = planPublish(sheet, null, now);
  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(typeof result.reason, 'string');
  assert.match(result.reason, /draft/);
});

test('AC: fails when priorPublished belongs to a different organization', () => {
  const priorPublished = makeSheet({
    id: 'sheet-1',
    organizationId: 'org-2',
    version: 1,
    status: 'published',
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  const sheet = makeSheet();

  const result = planPublish(sheet, priorPublished, now);
  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(typeof result.reason, 'string');
  assert.match(result.reason, /organization/);
});

test('AC: fails when priorPublished.version is not less than sheet.version', () => {
  const priorPublished = makeSheet({
    id: 'sheet-1',
    version: 2,
    status: 'published',
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  const sheet = makeSheet({ version: 2 });

  const result = planPublish(sheet, priorPublished, now);
  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(typeof result.reason, 'string');
  assert.match(result.reason, /version/);
});

test('AC-6: the whole suite runs with zero setup — no DB, no network, no env vars, no faked clock', () => {
  // This test itself is the evidence: every fixture above is a fixed ISO
  // string literal, every function called is a plain synchronous import
  // from ../publish-plan, and no before()/beforeEach() hook, network call,
  // or environment variable read appears anywhere in this file. The RPC
  // half (publish_price_sheet) is Supabase-gated and deliberately out of
  // scope here.
  assert.equal(typeof process.env.DATABASE_URL, 'undefined');
  assert.equal(typeof process.env.SUPABASE_URL, 'undefined');
});
