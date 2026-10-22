import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isLineStale,
  normalizeCatalogName,
  findCatalogDuplicate,
  taskToLineDraft,
} from './estimate-line-helpers.ts';

test('isLineStale true when task newer', () => {
  assert.equal(
    isLineStale(
      { jobPlanTaskId: 't1', taskSnapshotAt: '2026-01-01T00:00:00Z' },
      { contentUpdatedAt: '2026-02-01T00:00:00Z' },
    ),
    true,
  );
});
test('isLineStale false when task older or equal', () => {
  const line = { jobPlanTaskId: 't1', taskSnapshotAt: '2026-02-01T00:00:00Z' };
  assert.equal(isLineStale(line, { contentUpdatedAt: '2026-01-01T00:00:00Z' }), false);
  assert.equal(isLineStale(line, { contentUpdatedAt: '2026-02-01T00:00:00Z' }), false);
});
test('isLineStale false on missing ids/timestamps', () => {
  const t = { contentUpdatedAt: '2026-02-01T00:00:00Z' };
  assert.equal(isLineStale({ taskSnapshotAt: '2026-01-01T00:00:00Z' }, t), false);
  assert.equal(isLineStale({ jobPlanTaskId: '', taskSnapshotAt: '2026-01-01T00:00:00Z' }, t), false);
  assert.equal(isLineStale({ jobPlanTaskId: 't1' }, t), false);
  assert.equal(isLineStale({ jobPlanTaskId: 't1', taskSnapshotAt: '2026-01-01T00:00:00Z' }, {}), false);
});
test('isLineStale false on NaN timestamps', () => {
  assert.equal(
    isLineStale({ jobPlanTaskId: 't1', taskSnapshotAt: 'nope' }, { contentUpdatedAt: '2026-02-01T00:00:00Z' }),
    false,
  );
  assert.equal(
    isLineStale({ jobPlanTaskId: 't1', taskSnapshotAt: '2026-01-01T00:00:00Z' }, { contentUpdatedAt: 'bad' }),
    false,
  );
});
test('isLineStale false on null task', () => {
  const line = { jobPlanTaskId: 't1', taskSnapshotAt: '2026-01-01T00:00:00Z' };
  assert.equal(isLineStale(line, null), false);
  assert.equal(isLineStale(line, undefined), false);
});

test('normalizeCatalogName', () => {
  assert.equal(normalizeCatalogName('  Paint WALL  '), 'paint wall');
  assert.equal(normalizeCatalogName(null), '');
  assert.equal(normalizeCatalogName(undefined), '');
});

test('findCatalogDuplicate', () => {
  const cat = [
    { id: 'a', name: 'Hang Door', active: true },
    { id: 'b', name: 'Old Task', active: false },
  ];
  assert.equal(findCatalogDuplicate(cat, '  hang door ')?.id, 'a');
  assert.equal(findCatalogDuplicate(cat, 'nothing'), undefined);
  assert.equal(findCatalogDuplicate(cat, 'OLD task')?.id, 'b');
  assert.equal(findCatalogDuplicate(cat, '   '), undefined);
});

test('taskToLineDraft maps fields, no price, link ids set', () => {
  const d = taskToLineDraft({
    id: 'p1',
    title: 'Install',
    serviceTaskId: 's1',
    quantity: 3,
    unit: 'ea',
    area: 'Kitchen',
    materialsNote: 'screws',
  });
  assert.equal(d.kind, 'labor');
  assert.equal(d.description, 'Install');
  assert.equal(d.quantity, 3);
  assert.equal(d.jobPlanTaskId, 'p1');
  assert.equal(d.serviceTaskId, 's1');
  assert.equal(d.unit, 'ea');
  assert.equal(d.area, 'Kitchen');
  assert.equal(d.materialsNote, 'screws');
  assert.equal('unitCost' in d, false);
  const e = taskToLineDraft({ id: 'p2', title: 'X', quantity: 0 });
  assert.equal(e.quantity, 1);
  assert.equal(e.serviceTaskId, null);
  assert.equal(e.materialsNote, undefined);
});
