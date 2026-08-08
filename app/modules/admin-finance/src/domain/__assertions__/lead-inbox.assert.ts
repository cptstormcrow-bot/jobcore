/**
 * Assertions for the lead inbox selector (P3e.6b).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock.
 * Fixtures come from `../../fixtures/leads`, itself fixed data.
 *
 * This is the real-output verification for P3e.6b: incomplete leads are
 * first-class and must never be filtered out of the inbox.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { selectInboxLeads } from '../lead-inbox';
import { classifyLead } from '../lead-readiness';
import { heroLead, bookingLead, addressMissingLead } from '../../fixtures/leads';

test('P3e.6b: the needs_info hero lead is present in the inbox, not filtered out', () => {
  assert.equal(classifyLead(heroLead), 'needs_info');
  const inbox = selectInboxLeads([heroLead, bookingLead, addressMissingLead]);
  assert.ok(
    inbox.some((lead) => lead.id === heroLead.id),
    'expected heroLead to appear in the inbox list',
  );
  assert.equal(inbox.length, 3, 'expected all three unconverted fixtures to appear');
});

test('P3e.5: the inbox orders leads newest first by createdAt', () => {
  const inbox = selectInboxLeads([heroLead, bookingLead, addressMissingLead]);
  const createdTimes = inbox.map((lead) => new Date(lead.createdAt).getTime());
  const sortedDescending = [...createdTimes].sort((a, b) => b - a);
  assert.deepEqual(createdTimes, sortedDescending);
  // heroLead (09:00:00) is strictly older than bookingLead/addressMissingLead
  // (both 09:15:00) -- it must sort last, not first and not hidden.
  assert.equal(inbox[inbox.length - 1]?.id, heroLead.id);
});

test('P3e.5: the inbox excludes converted leads', () => {
  const converted: typeof bookingLead = { ...bookingLead, id: 'lead-converted-1', convertedJobId: 'job-1' };
  const inbox = selectInboxLeads([heroLead, converted]);
  assert.ok(!inbox.some((lead) => lead.id === converted.id));
  assert.ok(inbox.some((lead) => lead.id === heroLead.id));
});
