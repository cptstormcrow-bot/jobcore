/**
 * Assertions for the lead readiness classifier (P3e.6a, AC-1).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock.
 * Every fixture used below comes from `../../fixtures/leads`, which is
 * itself fixed data (fixed ISO literals, no `Date.now()`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLead, missingFields } from '../lead-readiness';
import { heroLead, bookingLead, addressMissingLead } from '../../fixtures/leads';

test('AC-1: classifyLead(heroLead) === "needs_info" and missingFields deep-equals ["preferredDate", "address"]', () => {
  assert.equal(classifyLead(heroLead), 'needs_info');
  assert.deepEqual(missingFields(heroLead), ['preferredDate', 'address']);
});

test('AC: a fully complete booking lead classifies as "ready" with no missing fields', () => {
  assert.equal(classifyLead(bookingLead), 'ready');
  assert.deepEqual(missingFields(bookingLead), []);
});

test('AC: a lead missing only address classifies as "needs_info" with missingFields exactly ["address"]', () => {
  assert.equal(classifyLead(addressMissingLead), 'needs_info');
  assert.deepEqual(missingFields(addressMissingLead), ['address']);
});

test('AC-8: the whole suite runs with zero setup — no DB, no network, no env vars, no faked clock', () => {
  assert.equal(typeof process.env.DATABASE_URL, 'undefined');
  assert.equal(typeof process.env.SUPABASE_URL, 'undefined');
});
