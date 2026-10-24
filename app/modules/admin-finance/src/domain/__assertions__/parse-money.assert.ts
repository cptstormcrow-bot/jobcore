/**
 * Assertions for `parseMoneyToCents`, `centsToDollarsText`, `parsePercent`.
 *
 * Runs under `node --experimental-strip-types --test` — zero setup.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { centsToDollarsText, parseMoneyToCents, parsePercent } from '../parse-money';

test('parseMoneyToCents accepts valid amounts', () => {
  assert.equal(parseMoneyToCents('12'), 1200);
  assert.equal(parseMoneyToCents('$1,234.5'), 123450);
  assert.equal(parseMoneyToCents('.5'), 50);
  assert.equal(parseMoneyToCents('0'), 0);
});

test('parseMoneyToCents rejects invalid amounts', () => {
  assert.equal(parseMoneyToCents('19.999'), null);
  assert.equal(parseMoneyToCents('-3'), null);
  assert.equal(parseMoneyToCents(''), null);
  assert.equal(parseMoneyToCents('abc'), null);
});

test('centsToDollarsText formats cents', () => {
  assert.equal(centsToDollarsText(1250), '12.50');
  assert.equal(centsToDollarsText(null), '');
});

test('parsePercent accepts 0-100', () => {
  assert.equal(parsePercent('15'), 15);
  assert.equal(parsePercent('15.5%'), 15.5);
  assert.equal(parsePercent('100'), 100);
});

test('parsePercent with max 50', () => {
  assert.equal(parsePercent('50', 50), 50);
  assert.equal(parsePercent('50.01', 50), null);
  assert.equal(parsePercent('0', 50), 0);
  assert.equal(parsePercent('25%', 50), 25);
  assert.equal(parsePercent('60', 50), null);
  assert.equal(parsePercent('100'), 100);
});

test('parsePercent rejects out of range or empty', () => {
  assert.equal(parsePercent('100.01'), null);
  assert.equal(parsePercent('-1'), null);
  assert.equal(parsePercent(''), null);
});
