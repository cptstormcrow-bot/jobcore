/**
 * Assertions for canAssignServiceTech / SERVICE_TECH_GATE_HINT. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { canAssignServiceTech, canScheduleJob, SCHEDULE_MATERIALS_HINT, SERVICE_TECH_GATE_HINT } from '../service-tech-gate';

test('scheduling needs Materials Onsite checked (uber 156)', () => {
  assert.equal(canScheduleJob({ materialsOnsite: true }), true);
  assert.equal(canScheduleJob({ materialsOnsite: false }), false);
  assert.equal(canScheduleJob({}), false);
  assert.equal(canScheduleJob(null), true);
  assert.equal(canScheduleJob(undefined), true);
  assert.ok(SCHEDULE_MATERIALS_HINT.length > 0);
});

test('true only when materialsOnsite is true', () => {
  assert.equal(canAssignServiceTech({ materialsOnsite: true }), true);
  assert.equal(canAssignServiceTech({ materialsOnsite: false }), false);
  assert.equal(canAssignServiceTech({}), false);
});

test('missing estimate is false', () => {
  assert.equal(canAssignServiceTech(undefined), false);
  assert.equal(canAssignServiceTech(null), false);
});

test('materials arrived on the investigation also opens the gate', () => {
  assert.equal(canAssignServiceTech(null, { materialsArrived: true }), true);
  assert.equal(canAssignServiceTech(undefined, { materialsArrived: true }), true);
  assert.equal(canAssignServiceTech({ materialsOnsite: false }, { materialsArrived: true }), true);
  assert.equal(canAssignServiceTech({ materialsOnsite: true }, { materialsArrived: false }), true);
  assert.equal(canAssignServiceTech({ materialsOnsite: false }, { materialsArrived: false }), false);
  assert.equal(canAssignServiceTech(null, { materialsArrived: null }), false);
  assert.equal(canAssignServiceTech(null, null), false);
  assert.equal(canAssignServiceTech(null, {}), false);
});

test('an Approved estimate opens the gate (uber 127)', () => {
  assert.equal(canAssignServiceTech({ status: 'approved' }), true);
  assert.equal(canAssignServiceTech({ status: 'submitted' }), false);
  assert.equal(canAssignServiceTech({ status: 'draft' }), false);
});

test('SERVICE_TECH_GATE_HINT is a non-empty string', () => {
  assert.equal(typeof SERVICE_TECH_GATE_HINT, 'string');
  assert.ok(SERVICE_TECH_GATE_HINT.length > 0);
});
