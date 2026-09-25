/**
 * Assertions for `parseAdjustmentPercent` (F10 slice S4).
 *
 * Runs under `node --experimental-strip-types --test` — zero setup: no DB,
 * no network, no env vars, no faked clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAdjustmentPercent } from '../parse-adjustment-percent';

test('plain integer string parses to a number', () => {
  assert.equal(parseAdjustmentPercent('20'), 20);
});

test('leading plus and trailing percent sign are stripped', () => {
  assert.equal(parseAdjustmentPercent('+20%'), 20);
});

test('surrounding whitespace and percent sign are stripped, sign preserved', () => {
  assert.equal(parseAdjustmentPercent(' -5 % '), -5);
});

test('decimal string parses to a number', () => {
  assert.equal(parseAdjustmentPercent('12.5'), 12.5);
});

test('empty string returns null', () => {
  assert.equal(parseAdjustmentPercent(''), null);
});

test('whitespace-only string returns null', () => {
  assert.equal(parseAdjustmentPercent('   '), null);
});

test('non-numeric string returns null', () => {
  assert.equal(parseAdjustmentPercent('abc'), null);
});

test('percent sign alone returns null', () => {
  assert.equal(parseAdjustmentPercent('%'), null);
});

test('ASCII leading minus parses to a signed negative number', () => {
  assert.equal(parseAdjustmentPercent('-15'), -15);
});

test('Unicode minus sign (U+2212) parses to a signed negative number', () => {
  assert.equal(parseAdjustmentPercent('−15'), -15);
});

test('explicit leading plus parses to a positive number', () => {
  assert.equal(parseAdjustmentPercent('+20'), 20);
});
