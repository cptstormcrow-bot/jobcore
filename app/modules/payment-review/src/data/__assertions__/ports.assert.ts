/**
 * Assertions for `hasSettledPaymentForJob` (payment-review data seam).
 *
 * Runs under `node --experimental-strip-types --test` — no DB, no network.
 * A fake Supabase client with a thenable query chain stands in for the real one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { hasSettledPaymentForJob } from '../ports';
import type { PaymentRow, SupabaseSelectClient } from '../ports';

function makeRow(status: string): PaymentRow {
  return {
    id: 'pay-1',
    organization_id: 'org-1',
    job_id: 'job-1',
    provider_id: 'prov-1',
    amount: 100,
    status,
    external_ref: null,
    confirmed_at: null,
    confirmed_by: null,
    created_at: '2026-08-01T13:00:00.000Z',
  };
}

function fakeClient(rows: PaymentRow[]): SupabaseSelectClient {
  const result = { data: rows, error: null };
  const terminal = {
    in: () => Promise.resolve(result),
  };
  return {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve(result),
        eq: () => terminal,
      }),
    }),
  };
}

test('confirmed row settles the job', async () => {
  assert.equal(await hasSettledPaymentForJob(fakeClient([makeRow('confirmed')]), 'job-1'), true);
});

test('manual_confirmed row settles the job', async () => {
  assert.equal(await hasSettledPaymentForJob(fakeClient([makeRow('manual_confirmed')]), 'job-1'), true);
});

test('pending-only rows do not settle the job', async () => {
  assert.equal(await hasSettledPaymentForJob(fakeClient([makeRow('pending')]), 'job-1'), false);
});

test('no rows does not settle the job', async () => {
  assert.equal(await hasSettledPaymentForJob(fakeClient([]), 'job-1'), false);
});
