/**
 * Assertions for `../lead-repo.ts` (S1 of the admin-finance overview plan).
 *
 * Zero setup: no DB, no network, no env vars, no faked clock. A hand-built
 * fake Supabase client (matching the minimal `{ from }` seam `lead-repo.ts`
 * depends on) stands in for the real `@supabase/supabase-js` client.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listLeadsForOrganization,
  createLead,
  markLeadQualified,
  updateLead,
  toLeadRowPatch,
  type LeadPatchInput,
} from '../lead-repo';
import type { LeadRow } from '../../domain/lead';
import type { NewLeadDraft } from '../../domain/intake-normalize';

function makeRow(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 'lead-1',
    organization_id: 'org-1',
    source_form: 'hero',
    name: 'Jane Doe',
    phone: '555-0100',
    email: 'jane@example.com',
    service: 'roofing',
    preferred_date: '2026-09-10',
    preferred_time: 'morning',
    address: '123 Main St',
    project_details: 'Leak repair',
    source: 'website',
    payer: 'owner',
    attach_timing: 'same-day',
    qualified_at: null,
    converted_job_id: null,
    created_at: '2026-08-10T00:00:00Z',
    ...overrides,
  };
}

/** Fake chainable Supabase client covering select/insert/update as lead-repo.ts calls them. */
function makeFakeClient(rows: LeadRow[]) {
  const calls: { op: string; args: unknown[] }[] = [];
  const client = {
    from(table: string) {
      assert.equal(table, 'leads');
      let filtered = rows;
      let insertedOrUpdated: Record<string, unknown> | null = null;
      const builder = {
        select(_cols: string) {
          calls.push({ op: 'select', args: [_cols] });
          return builder;
        },
        eq(column: string, value: unknown) {
          calls.push({ op: 'eq', args: [column, value] });
          filtered = filtered.filter((r) => (r as unknown as Record<string, unknown>)[column] === value);
          return builder;
        },
        insert(values: Record<string, unknown>) {
          calls.push({ op: 'insert', args: [values] });
          insertedOrUpdated = { ...makeRow(), ...values, id: 'lead-new' };
          return builder;
        },
        update(values: Record<string, unknown>) {
          calls.push({ op: 'update', args: [values] });
          const base = filtered[0] ?? makeRow();
          insertedOrUpdated = { ...base, ...values };
          return builder;
        },
        single() {
          return Promise.resolve({ data: insertedOrUpdated, error: null });
        },
        then(
          resolve: (value: { data: LeadRow[]; error: null }) => unknown,
          reject?: (reason: unknown) => unknown
        ) {
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

function makeErrorClient(message: string) {
  return {
    from(_table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        insert() {
          return builder;
        },
        update() {
          return builder;
        },
        single() {
          return Promise.resolve({ data: null, error: { message } });
        },
        then(resolve: (value: { data: null; error: { message: string } }) => unknown) {
          return Promise.resolve({ data: null, error: { message } }).then(resolve);
        },
      };
      return builder;
    },
  };
}

test('listLeadsForOrganization maps rows scoped to the organization', async () => {
  const { client } = makeFakeClient([makeRow(), makeRow({ id: 'lead-2', organization_id: 'org-2' })]);
  const result = await listLeadsForOrganization(client, 'org-1');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.length, 1);
    assert.equal(result.value[0]?.organizationId, 'org-1');
    assert.equal(result.value[0]?.name, 'Jane Doe');
  }
});

test('listLeadsForOrganization surfaces a query error as CalculationResult failure', async () => {
  const client = makeErrorClient('boom');
  const result = await listLeadsForOrganization(client, 'org-1');
  assert.deepEqual(result, { ok: false, reason: 'boom' });
});

test('createLead inserts from a NewLeadDraft and returns the mapped Lead with null qualification fields', async () => {
  const { client } = makeFakeClient([]);
  const draft: NewLeadDraft = {
    organizationId: 'org-1',
    sourceForm: 'hero',
    name: 'New Lead',
    phone: null,
    email: null,
    service: 'plumbing',
    preferredDate: null,
    preferredTime: null,
    address: null,
    projectDetails: null,
    source: 'referral',
    payer: 'owner',
    attachTiming: 'at_purchase',
  };
  const result = await createLead(client, draft);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.name, 'New Lead');
    assert.equal(result.value.organizationId, 'org-1');
    assert.equal(result.value.qualifiedAt, null);
    assert.equal(result.value.convertedJobId, null);
  }
});

test('markLeadQualified stamps qualified_at and converted_job_id', async () => {
  const { client } = makeFakeClient([makeRow()]);
  const result = await markLeadQualified(client, 'lead-1', 'job-9', '2026-09-04T00:00:00Z');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.qualifiedAt, '2026-09-04T00:00:00Z');
    assert.equal(result.value.convertedJobId, 'job-9');
  }
});

test('toLeadRowPatch only copies keys present on the patch, leaving others untouched', () => {
  const patch: LeadPatchInput = { name: 'Renamed', address: null };
  const rowPatch = toLeadRowPatch(patch);
  assert.deepEqual(rowPatch, { name: 'Renamed', address: null });
  assert.equal('phone' in rowPatch, false);
  assert.equal('preferred_date' in rowPatch, false);
});

test('updateLead applies a partial patch and returns the mapped Lead', async () => {
  const { client } = makeFakeClient([makeRow()]);
  const result = await updateLead(client, 'lead-1', { phone: '555-9999' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.phone, '555-9999');
    assert.equal(result.value.name, 'Jane Doe');
  }
});

test('the whole suite runs with zero setup: no DB, no network, no env vars, no faked clock', () => {
  assert.equal(typeof process.env.DATABASE_URL, 'undefined');
  assert.equal(typeof process.env.SUPABASE_URL, 'undefined');
});
