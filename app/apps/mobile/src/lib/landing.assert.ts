import test from 'node:test';
import assert from 'node:assert/strict';

import { landingRouteFor } from './landing';

const ALL = ['field-tech', 'admin-finance', 'sales-marketing'];

test('tech lands on field-tech', () => {
  assert.equal(landingRouteFor('tech', ALL), '/m/field-tech');
});
test('owner lands on admin-finance', () => {
  assert.equal(landingRouteFor('owner', ALL), '/m/admin-finance');
});
test('admin lands on admin-finance', () => {
  assert.equal(landingRouteFor('admin', ALL), '/m/admin-finance');
});
test('sales lands on sales-marketing', () => {
  assert.equal(landingRouteFor('sales', ALL), '/m/sales-marketing');
});
test('target module missing falls back to first module', () => {
  assert.equal(landingRouteFor('tech', ['admin-finance']), '/m/admin-finance');
});
test('unknown or null role falls back to first module', () => {
  assert.equal(landingRouteFor('mystery', ['sales-marketing']), '/m/sales-marketing');
  assert.equal(landingRouteFor(null, ['field-tech']), '/m/field-tech');
});
test('no modules goes to sign-in', () => {
  assert.equal(landingRouteFor('admin', []), '/sign-in');
});
test('never returns "/"', () => {
  for (const role of ['owner', 'admin', 'tech', 'sales', 'x', null, undefined]) {
    for (const mods of [[], ['field-tech'], ALL]) {
      assert.notEqual(landingRouteFor(role, mods), '/');
    }
  }
});
