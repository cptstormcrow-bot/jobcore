import test from 'node:test';
import assert from 'node:assert/strict';

import { landingRouteFor } from './landing';

test('tech with field-tech module lands on field-tech', () => {
  assert.equal(landingRouteFor('tech', ['field-tech', 'admin-finance']), '/m/field-tech');
});
test('tech without field-tech module gets null', () => {
  assert.equal(landingRouteFor('tech', ['admin-finance']), null);
});
test('admin gets null', () => {
  assert.equal(landingRouteFor('admin', ['field-tech']), null);
});
test('sales gets null', () => {
  assert.equal(landingRouteFor('sales', ['field-tech', 'sales-marketing']), null);
});
test('null role gets null', () => {
  assert.equal(landingRouteFor(null, ['field-tech']), null);
});
