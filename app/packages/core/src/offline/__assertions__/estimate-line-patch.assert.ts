import test from 'node:test';
import assert from 'node:assert/strict';

import { applyEstimateLinePatch, estimateLinePatchToRow } from '../estimate-line-patch.js';

const T = '2026-10-29T10:00:00.000Z';

test('row patch maps only the fields that were set and stamps the snapshot', () => {
  assert.deepEqual(estimateLinePatchToRow({ description: 'Seal', quantity: 2, unitCost: 5, lineTotal: 10 }, T), {
    description: 'Seal',
    quantity: 2,
    unit_cost: 5,
    line_total: 10,
    task_snapshot_at: T,
  });
});

test('null clears a column, undefined leaves it out', () => {
  const row = estimateLinePatchToRow({ unit: null, area: undefined }, T);
  assert.deepEqual(row, { unit: null, task_snapshot_at: T });
  assert.equal('area' in row, false);
});

test('empty patch still carries only the stamp', () => {
  assert.deepEqual(estimateLinePatchToRow({}, T), { task_snapshot_at: T });
});

test('optimistic item keeps untouched fields, applies set ones, moves the stamp', () => {
  const item = { id: 'l1', description: 'Old', quantity: 1, unitCost: 4, lineTotal: 4, unit: 'ea', taskSnapshotAt: 'x' };
  const next = applyEstimateLinePatch(item, { quantity: 3, lineTotal: 12, unit: null }, T);
  assert.deepEqual(next, { id: 'l1', description: 'Old', quantity: 3, unitCost: 4, lineTotal: 12, unit: null, taskSnapshotAt: T });
  assert.equal(item.quantity, 1);
});
