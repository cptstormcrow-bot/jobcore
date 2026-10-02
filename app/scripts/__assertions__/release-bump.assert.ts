import assert from 'node:assert/strict';
import { test } from 'node:test';

// @ts-ignore -- plain ESM script without type declarations
import { computeBump, pickNext, bumpVersion, compareSemver, NO_TAG_MESSAGE } from '../release.mjs';

const c = (subject: string, body = '') => ({ hash: 'abcdef1234', subject, body });

test('feat -> minor', () => {
  const r = computeBump([c('feat: add thing')], '0.2.0');
  assert.equal(r.level, 'minor');
  assert.equal(r.next, '0.3.0');
  assert.equal(r.groups.features.length, 1);
});

test('fix -> patch', () => {
  const r = computeBump([c('fix(ui): bug')], '0.2.0');
  assert.equal(r.level, 'patch');
  assert.equal(r.next, '0.2.1');
});

test('perf -> patch', () => {
  const r = computeBump([c('perf: faster')], '0.2.0');
  assert.equal(r.level, 'patch');
  assert.equal(r.groups.perf.length, 1);
});

test('breaking ! -> minor below 1.0', () => {
  const r = computeBump([c('feat!: drop api')], '0.2.0');
  assert.equal(r.level, 'minor');
  assert.equal(r.next, '0.3.0');
  assert.equal(r.groups.breaking.length, 1);
});

test('BREAKING CHANGE body -> minor below 1.0', () => {
  const r = computeBump([c('fix: x', 'details\n\nBREAKING CHANGE: gone')], '0.2.0');
  assert.equal(r.level, 'minor');
  assert.equal(r.groups.breaking.length, 1);
});

test('breaking -> major at 1.0+', () => {
  assert.equal(computeBump([c('feat!: x')], '1.2.0').next, '2.0.0');
});

test('docs-only -> null', () => {
  const r = computeBump([c('docs: readme'), c('chore: x'), c('test: y')], '0.2.0');
  assert.equal(r.level, null);
  assert.equal(r.next, null);
});

test('non-conventional -> warning + null', () => {
  const r = computeBump([c('did some stuff')], '0.2.0');
  assert.equal(r.level, null);
  assert.equal(r.warnings.length, 1);
});

test('highest level wins', () => {
  assert.equal(computeBump([c('fix: a'), c('feat: b')], '0.2.0').next, '0.3.0');
});

test('global-tag floor: current 0.2.0, global v0.3.0, feat -> 0.4.0', () => {
  const r = computeBump([c('feat: x')], '0.2.0');
  assert.equal(pickNext(r.next, 'v0.3.0', r.level, ['v0.2.0', 'v0.3.0']), '0.4.0');
});

test('existing tag aborts', () => {
  assert.throws(() => pickNext('0.3.0', null, 'minor', ['v0.2.0', 'v0.3.0']), /already exists/);
});

test('semver helpers', () => {
  assert.equal(bumpVersion('0.2.0', 'patch'), '0.2.1');
  assert.equal(compareSemver('v0.10.0', 'v0.9.0'), 1);
});

test('no-tag message carries baseline instruction', () => {
  assert.match(NO_TAG_MESSAGE, /tag v0\.2\.0 on the 0\.2\.0 release commit/i);
  assert.match(NO_TAG_MESSAGE, /git tag -a v0\.2\.0 <sha> -m "v0\.2\.0"/);
});
