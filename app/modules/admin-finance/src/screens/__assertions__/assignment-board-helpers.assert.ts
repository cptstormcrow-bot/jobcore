/**
 * Assertions for assignment-board helpers (pure, no side effects, no React).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no clock, no
 * randomness (every value below is a fixed string literal).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultKind, pickerValue, needsConfirm, techOptionsFor } from '../assignment-board-helpers';

const TECHS = [
  { id: 'tech-a', fullName: 'Ann Alpha' },
  { id: 'tech-b', fullName: 'Ben Bravo' },
];

test('defaultKind: prem only when service is empty and prem is set', () => {
  assert.equal(defaultKind(null, null), 'service');
  assert.equal(defaultKind('tech-a', null), 'service');
  assert.equal(defaultKind(null, 'tech-b'), 'prem');
  assert.equal(defaultKind('tech-a', 'tech-b'), 'service');
});

test('pickerValue: pick wins, otherwise active kind assignee', () => {
  assert.equal(pickerValue('service', undefined, 'tech-a', 'tech-b'), 'tech-a');
  assert.equal(pickerValue('prem', undefined, 'tech-a', 'tech-b'), 'tech-b');
  assert.equal(pickerValue('prem', undefined, 'tech-a', null), '');
  assert.equal(pickerValue('service', undefined, null, 'tech-b'), '');
  assert.equal(pickerValue('service', 'tech-c', 'tech-a', 'tech-b'), 'tech-c');
  assert.equal(pickerValue('prem', 'tech-c', 'tech-a', 'tech-b'), 'tech-c');
  assert.equal(pickerValue('service', '', 'tech-a', 'tech-b'), '');
});

test('needsConfirm: only when a pick differs from the active kind assignee', () => {
  assert.equal(needsConfirm('service', undefined, 'tech-a', 'tech-b'), false);
  assert.equal(needsConfirm('prem', undefined, 'tech-a', 'tech-b'), false);
  assert.equal(needsConfirm('service', 'tech-a', 'tech-a', 'tech-b'), false);
  assert.equal(needsConfirm('prem', 'tech-b', 'tech-a', 'tech-b'), false);
  assert.equal(needsConfirm('prem', 'tech-a', 'tech-a', 'tech-b'), true);
  assert.equal(needsConfirm('service', '', 'tech-a', 'tech-b'), true);
  assert.equal(needsConfirm('prem', '', 'tech-a', null), false);
  assert.equal(needsConfirm('service', 'tech-c', null, null), true);
});

test('techOptionsFor: Unassigned prepended except prem with a current assignee', () => {
  const unassigned = { label: 'Unassigned', value: '' };
  const ann = { label: 'Ann Alpha', value: 'tech-a' };
  const ben = { label: 'Ben Bravo', value: 'tech-b' };
  assert.deepEqual(techOptionsFor('service', TECHS, 'tech-a'), [unassigned, ann, ben]);
  assert.deepEqual(techOptionsFor('prem', TECHS, null), [unassigned, ann, ben]);
  assert.deepEqual(techOptionsFor('prem', TECHS, 'tech-b'), [ann, ben]);
  assert.deepEqual(techOptionsFor('service', [], null), [unassigned]);
});
