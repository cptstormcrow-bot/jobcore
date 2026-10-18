/**
 * Assertions for canAssignServiceTech / SERVICE_TECH_GATE_HINT. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { canAssignServiceTech, SERVICE_TECH_GATE_HINT } from '../service-tech-gate';

test('true only when materialsOnsite is true', () => {
  assert.equal(canAssignServiceTech({ materialsOnsite: true }), true);
  assert.equal(canAssignServiceTech({ materialsOnsite: false }), false);
  assert.equal(canAssignServiceTech({}), false);
});

test('missing estimate is false', () => {
  assert.equal(canAssignServiceTech(undefined), false);
  assert.equal(canAssignServiceTech(null), false);
});

test('SERVICE_TECH_GATE_HINT is a non-empty string', () => {
  assert.equal(typeof SERVICE_TECH_GATE_HINT, 'string');
  assert.ok(SERVICE_TECH_GATE_HINT.length > 0);
});
