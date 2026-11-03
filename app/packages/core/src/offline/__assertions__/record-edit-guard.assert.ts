import test from 'node:test';
import assert from 'node:assert/strict';

import {
  captureCamelEditBase,
  captureRecordEditBase,
  ESTIMATE_FIELD_TO_COLUMN,
  decideRecordEdit,
  describeRecordEditConflict,
  mergeNotes,
  ESTIMATE_EDIT_POLICY,
  LEAD_EDIT_POLICY,
  PAYROLL_TIME_EDIT_POLICY,
} from '../record-edit-guard.js';
import { estimateLineEditBase } from '../estimate-line-patch.js';

test('no base applies everything (old queued rows)', () => {
  const d = decideRecordEdit({ name: 'A', phone: '1' }, undefined, { name: 'B', phone: '2' }, LEAD_EDIT_POLICY);
  assert.deepEqual(d, { apply: { name: 'A', phone: '1' }, conflicts: [], merged: [] });
});

test('unchanged row version applies everything', () => {
  const base = { updatedAt: '2026-11-03T10:00:00Z', values: { minutes: 60 } };
  const d = decideRecordEdit({ minutes: 90 }, base, { updated_at: '2026-11-03T10:00:00.000Z', minutes: 75 }, PAYROLL_TIME_EDIT_POLICY);
  assert.deepEqual(d.apply, { minutes: 90 });
  assert.deepEqual(d.conflicts, []);
});

test('important field changed by someone else still saves ours, and is noted', () => {
  const base = { values: { name: 'Ann', phone: '111' } };
  const d = decideRecordEdit({ name: 'Anne', phone: '222' }, base, { name: 'Annie', phone: '111' }, LEAD_EDIT_POLICY);
  assert.deepEqual(d.apply, { name: 'Anne', phone: '222' });
  assert.deepEqual(d.conflicts, ['name']);
});

test('server already holding our value is skipped, not a conflict', () => {
  const base = { values: { email: 'a@x' } };
  const d = decideRecordEdit({ email: 'b@x' }, base, { email: 'b@x' }, LEAD_EDIT_POLICY);
  assert.deepEqual(d, { apply: {}, conflicts: [], merged: [] });
});

test('simple field always wins', () => {
  const base = { values: { source: 'web' } };
  const d = decideRecordEdit({ source: 'phone' }, base, { source: 'referral' }, LEAD_EDIT_POLICY);
  assert.deepEqual(d.apply, { source: 'phone' });
  assert.deepEqual(d.conflicts, []);
});

test('notes changed on both sides keep both versions', () => {
  const base = { values: { project_details: 'Fix door' } };
  const d = decideRecordEdit(
    { project_details: 'Fix door\nBring hinges' },
    base,
    { project_details: 'Fix door\nCustomer home after 3' },
    LEAD_EDIT_POLICY,
  );
  assert.equal(d.apply.project_details, 'Fix door\nCustomer home after 3\nBring hinges');
  assert.deepEqual(d.merged, ['project_details']);
  assert.deepEqual(d.conflicts, []);
});

test('mergeNotes rules', () => {
  assert.equal(mergeNotes('', 'ours', 'x'), 'ours');
  assert.equal(mergeNotes('theirs and ours', 'ours', 'x'), 'theirs and ours');
  assert.equal(mergeNotes('theirs', 'ours', 'base'), 'theirs\n\nours');
  assert.equal(mergeNotes('base plus theirs', 'base plus ours', 'base'), 'base plus theirs plus ours');
});

test('captureRecordEditBase keeps only listed columns and the version', () => {
  assert.equal(captureRecordEditBase(null, ['a']), undefined);
  assert.deepEqual(captureRecordEditBase({ a: 1, b: 2 }, ['a', 'c'], '2026-11-03T00:00:00Z'), {
    updatedAt: '2026-11-03T00:00:00Z',
    values: { a: 1 },
  });
  assert.deepEqual(captureRecordEditBase({ a: undefined }, ['a']), { values: { a: null } });
});

test('clash note names the fields in plain words', () => {
  assert.equal(
    describeRecordEditConflict(['minutes', 'clock_in_at'], 1, 'time entry'),
    "Saved your version: the time entry's hours and clock-in time were also changed by someone else while you were offline.",
  );
});

test('derived totals follow the server, never a conflict', () => {
  const base = { values: { total_cost: 100, labor_cost: 40 } };
  const d = decideRecordEdit({ total_cost: 150, labor_cost: 60 }, base, { total_cost: 120, labor_cost: 40 }, ESTIMATE_EDIT_POLICY);
  assert.deepEqual(d, { apply: { labor_cost: 60 }, conflicts: [], merged: [] });
});

test('numeric string from the server equals the same number', () => {
  const base = { values: { deposit_amount: 50 } };
  const d = decideRecordEdit({ deposit_amount: 75 }, base, { deposit_amount: '50.00' }, ESTIMATE_EDIT_POLICY);
  assert.deepEqual(d, { apply: { deposit_amount: 75 }, conflicts: [], merged: [] });
});

test('captureCamelEditBase maps camel fields the record carries', () => {
  assert.equal(captureCamelEditBase(null, ['status'], ESTIMATE_FIELD_TO_COLUMN), undefined);
  assert.deepEqual(
    captureCamelEditBase({ status: 'draft', depositAmount: 10 }, ['status', 'depositAmount', 'summary', 'nope'], ESTIMATE_FIELD_TO_COLUMN),
    { values: { status: 'draft', deposit_amount: 10 } },
  );
});

test('estimateLineEditBase covers only the fields the patch sets', () => {
  const item = { description: 'Hinge', quantity: 2, unitCost: 5 };
  const base = estimateLineEditBase(item, { quantity: 3 } as never);
  assert.deepEqual(base, { values: { quantity: 2 } });
});
