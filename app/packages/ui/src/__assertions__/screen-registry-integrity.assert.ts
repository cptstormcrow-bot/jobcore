/**
 * Integrity assertions over the real screen-registry.json: archivedJobs
 * resolves to #92, numbers/keys are unique, (route, subView) pairs distinct.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveScreen, scopeOf, type RegistryEntry } from '../screen-numbers/screen-resolve';

const registry: RegistryEntry[] = JSON.parse(
  readFileSync(new URL('../../../../apps/mobile/src/screens/screen-registry.json', import.meta.url), 'utf8'),
);

test('admin-finance archivedJobs resolves to screen 92, not 10', () => {
  const hit = resolveScreen('/m/admin-finance', registry, 'archivedJobs');
  assert.equal(hit?.number, 92);
  assert.notEqual(hit?.number, 10);
});

test('registry numbers are unique', () => {
  const nums = registry.map((e) => e.number);
  assert.equal(new Set(nums).size, nums.length);
});

test('registry keys are unique', () => {
  const keys = registry.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('non-null subView entries have distinct (route, subView) pairs', () => {
  const pairs = registry
    .filter((e) => e.subView != null)
    .map((e) => JSON.stringify([e.route, e.subView, scopeOf(e.file)]));
  assert.equal(new Set(pairs).size, pairs.length);
});
