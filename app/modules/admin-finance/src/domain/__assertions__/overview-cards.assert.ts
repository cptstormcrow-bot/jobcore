/**
 * Assertions for `buildOverviewCards`.
 *
 * Runs under `node --experimental-strip-types --test` — zero setup.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOverviewCards } from '../overview-cards';

// Manual mirror of the hamburger menu in AdminFinanceRoot.tsx (that file is
// .tsx and cannot load under npm test): 'overview' plus the 9 card ids.
const HAMBURGER_IDS = [
  'overview', 'leadInbox', 'jobs', 'assignmentBoard', 'priceSheetList',
  'payments', 'payroll', 'calendar', 'reports', 'employee-roster',
];

const COUNTS = {
  jobsOnFile: 7,
  qualifiedOrScheduled: 3,
  awaitingCloseOut: 2,
  employees: 9,
};

const ZERO = {
  jobsOnFile: 0,
  qualifiedOrScheduled: 0,
  awaitingCloseOut: 0,
  employees: 0,
};

test('returns 9 rows in menu order', () => {
  const cards = buildOverviewCards(COUNTS);
  assert.equal(cards.length, 9);
  assert.deepEqual(cards.map((c) => c.id), [
    'leadInbox', 'jobs', 'assignmentBoard', 'priceSheetList',
    'payments', 'payroll', 'calendar', 'reports', 'employee-roster',
  ]);
});

test('titles are in exact order', () => {
  assert.deepEqual(buildOverviewCards(COUNTS).map((c) => c.title), [
    'Leads', 'Jobs', 'Assignments','Price Sheets', 'Payments & Payouts',
    'Payroll', 'Calendar', 'Reports', 'Employees',
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
  assert.equal(sub('payroll'), 'Weekly hours and pay');
  assert.equal(sub('employee-roster'), '9 on file');
});

test('zero counts render as zero, not the fallback', () => {
  const sub = (id: string) => buildOverviewCards(ZERO).find((c) => c.id === id)?.subtitle;
  assert.equal(sub('jobs'), '0 on file for this organization');
});

test('Review card is gone (redundant to Payments)', () => {
  assert.ok(!buildOverviewCards(COUNTS).some((c) => (c.id as string) === 'paymentReview'));
});
