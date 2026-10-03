/**
 * Assertions for Prem Jobs screen helpers (pure, no side effects, no React).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock
 * (each timestamp used below is a fixed ISO literal, never `Date.now()`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { premCardAction, premReportRoute, formatNeedsPremSince } from '../prem-jobs-helpers';

test('premCardAction(true) is Record', () => {
  assert.equal(premCardAction(true), 'Record');
});

test('premCardAction(false) is Claim', () => {
  assert.equal(premCardAction(false), 'Claim');
});

test('premReportRoute builds the investigation panel route', () => {
  assert.equal(premReportRoute('abc-123'), '/job/abc-123?panel=jobInvestigation');
});

test('formatNeedsPremSince returns null for null and undefined', () => {
  assert.equal(formatNeedsPremSince(null), null);
  assert.equal(formatNeedsPremSince(undefined as never), null);
});

test('formatNeedsPremSince formats an ISO timestamp as a short date', () => {
  assert.match(formatNeedsPremSince('2026-09-02T12:00:00.000Z') as string, /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
});
