/**
 * Assertions for sync-issues helpers. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { opLabel, savedAtLabel, failureMessage } from './sync-issues';

test('known ops map to plain labels', () => {
  assert.equal(opLabel('job_time_entry.clock_out'), 'Clock out');
  assert.equal(opLabel('job_photo.create'), 'Job photo');
  assert.equal(opLabel('job_note.create'), 'Note');
});

test('unknown ops fall back to entity/action or humanized text', () => {
  assert.equal(opLabel('employee.deactivate'), 'Employee deactivated');
  assert.equal(opLabel('widget.frobnicate'), 'Widget frobnicate');
  assert.equal(opLabel(''), 'Change');
});

test('savedAtLabel formats valid ISO and tolerates junk', () => {
  assert.match(savedAtLabel('2026-10-29T15:04:00Z', 'en-US'), /^Saved Oct 29, 2026/);
  assert.equal(savedAtLabel('not-a-date'), 'Saved not-a-date');
  assert.equal(savedAtLabel(''), 'Saved on this device');
});

test('failureMessage uses the recorded error or a fallback', () => {
  assert.equal(failureMessage('  boom '), 'boom');
  assert.match(failureMessage(null), /could not be sent/);
});
