/**
 * Assertions for tracking-helpers (field-tech). This logic is a port of
 * JobEstimateScreen.runTrackingLookup / trackingStatusLine in admin-finance; module
 * isolation forbids importing it, so a change there must be mirrored here.
 * Runs under `node --experimental-strip-types --test`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { trackingResultToPatch, trackingStatusLine } from '../tracking-helpers';

const NOW = '2026-01-01T00:00:00.000Z';
const NOT_FOUND = { trackingNumber: '1Z999', trackingStatus: 'Not found', trackingCheckedAt: NOW };

test('empty or whitespace number clears the tracking fields', () => {
  const expected = {
    patch: { trackingNumber: null, trackingStatus: null, trackingCheckedAt: null },
    message: null,
  };
  assert.deepEqual(trackingResultToPatch('', null, NOW), expected);
  assert.deepEqual(trackingResultToPatch('   ', { ok: true, status: 'x', delivered: false }, NOW), expected);
});

test('null result keeps the number with a generic failure message', () => {
  assert.deepEqual(trackingResultToPatch('1Z999', null, NOW), {
    patch: { trackingNumber: '1Z999' },
    message: 'UPS lookup failed.',
  });
});

test('ups-not-configured keeps the number with a not-set-up message', () => {
  assert.deepEqual(
    trackingResultToPatch('1Z999', { ok: false, status: null, delivered: false, error: 'ups-not-configured' }, NOW),
    { patch: { trackingNumber: '1Z999' }, message: 'UPS lookup not set up yet' },
  );
});

test('other upstream error is surfaced as the message', () => {
  assert.deepEqual(
    trackingResultToPatch('1Z999', { ok: false, status: null, delivered: false, error: 'ups-upstream-500' }, NOW),
    { patch: { trackingNumber: '1Z999' }, message: 'ups-upstream-500' },
  );
});

test('Not found error yields the Not found patch', () => {
  assert.deepEqual(
    trackingResultToPatch('1Z999', { ok: false, status: null, delivered: false, error: 'Not found' }, NOW),
    { patch: NOT_FOUND, message: null },
  );
});

test('ok result with no status and not delivered yields the Not found patch', () => {
  assert.deepEqual(trackingResultToPatch('1Z999', { ok: true, status: null, delivered: false }, NOW), {
    patch: NOT_FOUND,
    message: null,
  });
});

test('delivered with deliveredAt uses it and flags materials onsite', () => {
  const at = '2025-12-30T12:00:00.000Z';
  assert.deepEqual(
    trackingResultToPatch('1Z999', { ok: true, status: 'Delivered', delivered: true, deliveredAt: at }, NOW),
    {
      patch: { trackingNumber: '1Z999', trackingStatus: 'Delivered', trackingCheckedAt: at, materialsOnsite: true },
      message: null,
    },
  );
});

test('delivered without deliveredAt falls back to nowIso', () => {
  assert.deepEqual(trackingResultToPatch('1Z999', { ok: true, status: 'Delivered', delivered: true }, NOW), {
    patch: { trackingNumber: '1Z999', trackingStatus: 'Delivered', trackingCheckedAt: NOW, materialsOnsite: true },
    message: null,
  });
});

test('in-transit status is stored with nowIso', () => {
  assert.deepEqual(trackingResultToPatch('1Z999', { ok: true, status: 'In Transit', delivered: false }, NOW), {
    patch: { trackingNumber: '1Z999', trackingStatus: 'In Transit', trackingCheckedAt: NOW },
    message: null,
  });
});

test('tracking number is trimmed', () => {
  const r = trackingResultToPatch('  1Z999  ', { ok: true, status: 'In Transit', delivered: false }, NOW);
  assert.equal(r.patch.trackingNumber, '1Z999');
});

test('trackingStatusLine: message wins over stored status', () => {
  assert.equal(trackingStatusLine({ trackingStatus: 'In Transit', trackingCheckedAt: NOW }, 'boom'), 'boom');
});

test('trackingStatusLine: null estimate or null status gives null', () => {
  assert.equal(trackingStatusLine(null, null), null);
  assert.equal(trackingStatusLine({ trackingStatus: null, trackingCheckedAt: NOW }, null), null);
});

test('trackingStatusLine: Not found maps to Not found at UPS', () => {
  assert.equal(trackingStatusLine({ trackingStatus: 'Not found', trackingCheckedAt: NOW }, null), 'Not found at UPS');
});

test('trackingStatusLine: status with checkedAt appends checked time', () => {
  const line = trackingStatusLine({ trackingStatus: 'In Transit', trackingCheckedAt: NOW }, null);
  assert.ok(line !== null && line.startsWith('UPS: In Transit · checked '));
});

test('trackingStatusLine: status without checkedAt is bare', () => {
  assert.equal(trackingStatusLine({ trackingStatus: 'In Transit', trackingCheckedAt: null }, null), 'UPS: In Transit');
});
