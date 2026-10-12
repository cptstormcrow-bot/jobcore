/**
 * Assertions for `buildOverviewCards`.
 *
 * Runs under `node --experimental-strip-types --test` — zero setup.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOverviewCards } from '../overview-cards';

// Manual mirror of the hamburger menu in AdminFinanceRoot.tsx (that file is
// .tsx and cannot load under npm test): 'overview' plus the 10 card ids.
const HAMBURGER_IDS = [
  'overview', 'leadInbox', 'jobs', 'assignmentBoard', 'priceSheetList',
  'payments', 'paymentReview', 'timeOffQueue', 'calendar', 'reports', 'employee-roster',
];

const COUNTS = {
  jobsOnFile: 7,
  qualifiedOrScheduled: 3,
  awaitingCloseOut: 2,
  pendingTimeOff: 4,
  employees: 9,
  needsAttentionPayments: 25 as number | null,
};

const ZERO = {
  jobsOnFile: 0,
  qualifiedOrScheduled: 0,
  awaitingCloseOut: 0,
  pendingTimeOff: 0,
  employees: 0,
  needsAttentionPayments: 0 as number | null,
};

test('returns 10 rows in menu order', () => {
  const cards = buildOverviewCards(COUNTS);
  assert.equal(cards.length, 10);
  assert.deepEqual(cards.map((c) => c.id), [
    'leadInbox', 'jobs', 'assignmentBoard', 'priceSheetList',
    'payments', 'paymentReview', 'timeOffQueue', 'calendar', 'reports', 'employee-roster',
  ]);
});

test('titles are in exact order', () => {
  assert.deepEqual(buildOverviewCards(COUNTS).map((c) => c.title), [
    'Leads', 'Jobs', 'Assignments','Price Sheets', 'Payments & Payouts',
    'Review', 'Time off', 'Calendar', 'Reports', 'Employees',
  ]);
});

test('every id is a hamburger menu id and ids are unique', () => {
  const ids = buildOverviewCards(COUNTS).map((c) => c.id);
  for (const id of ids) assert.ok(HAMBURGER_IDS.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
});

test('first row is Leads / View leads', () => {
  const first = buildOverviewCards(COUNTS)[0];
  assert.ok(first);
  assert.equal(first.id, 'leadInbox');
  assert.equal(first.subtitle, 'View leads');
});

test('count interpolation with distinct values', () => {
  const sub = (id: string) => buildOverviewCards(COUNTS).find((c) => c.id === id)?.subtitle;
  assert.equal(sub('jobs'), '7 on file for this organization');
  assert.equal(sub('assignmentBoard'), '3 qualified or scheduled');
  assert.equal(sub('paymentReview'), '25 pending');
  assert.equal(sub('timeOffQueue'), '4 pending');
  assert.equal(sub('employee-roster'), '9 on file');
});

test('zero counts render as zero, not the fallback', () => {
  const sub = (id: string) => buildOverviewCards(ZERO).find((c) => c.id === id)?.subtitle;
  assert.equal(sub('jobs'), '0 on file for this organization');
  assert.equal(sub('timeOffQueue'), '0 pending');
  assert.equal(sub('paymentReview'), '0 pending');
});

test('null needs-attention count falls back for Review', () => {
  const cards = buildOverviewCards({ ...COUNTS, needsAttentionPayments: null });
  assert.equal(cards.find((c) => c.id === 'paymentReview')?.subtitle, 'Reconcile payments');
});
