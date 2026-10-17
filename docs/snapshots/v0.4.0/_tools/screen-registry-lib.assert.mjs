import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumber, stampLine, parseStampLine, parseStampLines,
  orderCandidates, mintNumbers, checkRegistry, lookup,
} from './screen-registry-lib.mjs';

const c = (key, file, createdAt) => ({ key, file, title: `T ${key}`, route: `/${key}`, createdAt });

test('formatNumber', () => {
  assert.equal(formatNumber(1), '0001');
  assert.equal(formatNumber(42), '0042');
  for (const bad of [0, 10000, 1.5, -1]) assert.throws(() => formatNumber(bad), RangeError);
});

test('stamp round trip incl. " - " in title', () => {
  const s = { number: 7, key: 'a.b', title: 'Jobs - Day - List' };
  const line = stampLine(s);
  assert.equal(line, '// JobCore screen #0007 - a.b - Jobs - Day - List');
  assert.deepEqual(parseStampLine(line), s);
  assert.equal(parseStampLine('// nope'), null);
});

test('parseStampLines takes consecutive top lines only', () => {
  const text = '// JobCore screen #0001 - a - A\n// JobCore screen #0002 - b - B\nconst x = 1;\n// JobCore screen #0003 - c - C';
  assert.deepEqual(parseStampLines(text).map((p) => p.number), [1, 2]);
});

test('orderCandidates by createdAt then path', () => {
  const r = orderCandidates([c('z', 'b.ts', '2026-02-01'), c('y', 'a.ts', '2026-02-01'), c('x', 'z.ts', '2026-01-01')]);
  assert.deepEqual(r.map((e) => e.key), ['x', 'y', 'z']);
});

test('mint: first, append, tombstone, no reuse, revive, no mutation', () => {
  const first = mintNumbers([], [c('b', 'b.ts', '2026-01-02'), c('a', 'a.ts', '2026-01-01')], 'N1');
  assert.deepEqual(first.registry.map((e) => [e.key, e.number]), [['a', 1], ['b', 2]]);
  const frozen = JSON.stringify(first.registry);
  const second = mintNumbers(first.registry, [c('a', 'a.ts', '2026-01-01'), c('b', 'b.ts', '2026-01-02'), c('n', 'n.ts', '2026-03-01')], 'N2');
  assert.equal(JSON.stringify(first.registry), frozen);
  assert.deepEqual(second.registry.map((e) => e.number), [1, 2, 3]);
  const third = mintNumbers(second.registry, [c('a', 'a.ts', '2026-01-01'), c('n', 'n.ts', '2026-03-01')], 'N3');
  assert.equal(lookup(third.registry, 2).retiredAt, 'N3');
  assert.equal(third.retired.length, 1);
  const fourth = mintNumbers(third.registry, [c('a', 'a.ts', '2026-01-01'), c('n', 'n.ts', '2026-03-01'), c('q', 'q.ts', '2026-04-01')], 'N4');
  assert.equal(lookup(fourth.registry, 4).key, 'q');
  const fifth = mintNumbers(fourth.registry, [c('a', 'a.ts', '2026-01-01'), c('b', 'b.ts', '2026-01-02'), c('n', 'n.ts', '2026-03-01'), c('q', 'q.ts', '2026-04-01')], 'N5');
  const b = lookup(fifth.registry, 2);
  assert.equal(b.key, 'b');
  assert.equal(b.retiredAt, undefined);
  assert.equal(fifth.added.length, 0);
});

test('checkRegistry problem classes and tombstone exemption', () => {
  const e = (number, key, extra = {}) => ({ number, key, title: '', route: '', file: '', createdAt: '', ...extra });
  assert.deepEqual(checkRegistry([e(1, 'a')], ['a']), []);
  assert.equal(checkRegistry([e(1, 'a'), e(1, 'b')], ['a', 'b']).length, 1);
  assert.equal(checkRegistry([e(1, 'a'), e(2, 'a')], ['a']).length, 1);
  assert.equal(checkRegistry([e(1, 'a')], ['a', 'm']).length, 1);
  assert.equal(checkRegistry([e(1, 'a'), e(2, 'x')], ['a']).length, 1);
  assert.deepEqual(checkRegistry([e(1, 'a'), e(2, 'x', { retiredAt: 'N' })], ['a']), []);
  assert.deepEqual(checkRegistry([e(1, 'a'), e(2, 'x', { retiredAt: 'N', retiredInto: 1 })], ['a', 'x']), []);
  assert.equal(checkRegistry([e(1, 'a'), e(2, 'x', { retiredAt: 'N' })], ['a', 'x']).length, 1);
  assert.equal(checkRegistry([e(1, 'a'), e(2, 'x', { retiredAt: 'N', retiredInto: 9 })], ['a', 'x']).length, 2);
  assert.ok(checkRegistry([e(1, 'a', { retiredAt: 'N' }), e(2, 'x', { retiredAt: 'N', retiredInto: 1 })], ['x']).length >= 1);
});

test('mintNumbers keeps retiredInto tombstones retired', () => {
  const e = (number, key, extra = {}) => ({ number, key, title: '', route: '', file: '', createdAt: '', ...extra });
  const reg = [e(1, 'a'), e(2, 'x', { retiredAt: 'N', retiredInto: 1 })];
  const r = mintNumbers(reg, [c('a', 'a.ts', '2026-01-01'), c('x', 'x.ts', '2026-01-02')], 'N2');
  const x = r.registry.find((en) => en.key === 'x');
  assert.equal(x.retiredAt, 'N');
  assert.equal(x.retiredInto, 1);
  assert.equal(r.added.length, 0);
});

test('lookup', () => {
  const reg = [{ number: 5, key: 'k' }];
  assert.equal(lookup(reg, 5).key, 'k');
  assert.equal(lookup(reg, 6), null);
});
