/**
 * Assertions for employee-editor-logic (pure, no side effects, no React).
 * Runs under `node --experimental-strip-types --test`; all values are fixed literals.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { numberAreas } from '../employee-editor-logic';

test('numberAreas: empty input returns []', () => {
  assert.deepEqual(numberAreas([]), []);
});

test('numberAreas: three areas keep order and get n=1,2,3', () => {
  const out = numberAreas([
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Bravo' },
    { id: 'c', name: 'Charlie' },
  ]);
  assert.deepEqual(out, [
    { n: 1, id: 'a', name: 'Alpha' },
    { n: 2, id: 'b', name: 'Bravo' },
    { n: 3, id: 'c', name: 'Charlie' },
  ]);
});

test('numberAreas: input array is not mutated', () => {
  const input = [
    { id: 'z', name: 'Zulu' },
    { id: 'y', name: 'Yankee' },
  ];
  const snapshot = JSON.parse(JSON.stringify(input));
  const out = numberAreas(input);
  assert.deepEqual(input, snapshot);
  assert.notEqual(out as unknown, input as unknown);
});

test('numberAreas: single area gets n=1', () => {
  assert.deepEqual(numberAreas([{ id: 'x', name: 'Xray' }]), [{ n: 1, id: 'x', name: 'Xray' }]);
});
