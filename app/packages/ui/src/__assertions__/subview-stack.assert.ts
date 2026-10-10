import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertOwner,
  removeOwner,
  currentSubView,
  type SubViewOwner,
} from '../screen-numbers/subview-stack';

test('subview stack masks and restores', () => {
  const empty: readonly SubViewOwner[] = Object.freeze([]);
  assert.equal(currentSubView(empty), null);
  const a = upsertOwner(empty, 'A', 'planning');
  assert.equal(currentSubView(a), 'planning');
  const ab = upsertOwner(Object.freeze(a), 'B', null);
  assert.equal(currentSubView(ab), null);
  const back = removeOwner(Object.freeze(ab), 'B');
  assert.equal(currentSubView(back), 'planning');
});

test('update in place keeps position', () => {
  const ab = Object.freeze([{ id: 'A', subView: 'planning' }, { id: 'B', subView: null }]);
  const a2 = upsertOwner(ab, 'A', 'other');
  assert.deepEqual(a2.map((o) => o.id), ['A', 'B']);
  assert.equal(currentSubView(a2), null);
  const b2 = upsertOwner(ab, 'B', 'x');
  assert.equal(currentSubView(b2), 'x');
});

test('remove absent is a no-op copy and inputs are not mutated', () => {
  const s = Object.freeze([Object.freeze({ id: 'A', subView: 'planning' })]);
  const r = removeOwner(s, 'Z');
  assert.deepEqual(r, s);
  assert.notEqual(r, s);
  assert.equal(s.length, 1);
  assert.equal(s[0]!.subView, 'planning');
});
