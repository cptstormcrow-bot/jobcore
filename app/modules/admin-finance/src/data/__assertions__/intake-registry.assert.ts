/**
 * Assertions for the intake adapter registry (P7 Slice A).
 *
 * Runs under `node --experimental-strip-types --test` — zero setup: no DB,
 * no network, no env vars, no faked clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getIntakeAdapter,
  listIntakeAdapters,
  resolveIntakeAdapter,
} from '../intake-registry';
import { defaultManualEntryAdapter } from '../manual-entry-adapter';

test('resolveIntakeAdapter(undefined) returns the default ManualEntryAdapter singleton', () => {
  const adapter = resolveIntakeAdapter(undefined);

  assert.equal(adapter, defaultManualEntryAdapter);
  assert.equal(adapter.id, 'manual-entry');
});

test('getIntakeAdapter("manual-entry") returns the default ManualEntryAdapter singleton', () => {
  const adapter = getIntakeAdapter('manual-entry');

  assert.equal(adapter, defaultManualEntryAdapter);
});

test('resolveIntakeAdapter("manual-entry") resolves by id, same singleton', () => {
  const adapter = resolveIntakeAdapter('manual-entry');

  assert.equal(adapter, defaultManualEntryAdapter);
});

test('resolveIntakeAdapter throws on an unrecognized id', () => {
  assert.throws(
    () => resolveIntakeAdapter('unknown-id'),
    /Unknown lead intake adapter id "unknown-id"/,
  );
});

test('getIntakeAdapter returns undefined for an unrecognized id', () => {
  assert.equal(getIntakeAdapter('unknown-id'), undefined);
});

test('listIntakeAdapters contains the default ManualEntryAdapter singleton', () => {
  const adapters = listIntakeAdapters();

  assert.ok(adapters.includes(defaultManualEntryAdapter));
});
