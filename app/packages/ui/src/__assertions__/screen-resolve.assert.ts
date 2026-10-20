import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  scopeOf,
  normalizePath,
  matchRoute,
  resolveScreen,
  type RegistryEntry,
} from '../screen-numbers/screen-resolve';

function e(number: number, route: string | null, extra: Partial<RegistryEntry> = {}): RegistryEntry {
  return { number, key: 'k' + number, title: 't' + number, route, file: 'd' + number + '/f' + number, createdAt: '2026-01-01', ...extra };
}

const REG: RegistryEntry[] = [
  e(1, '/(tabs)/jobs'),
  e(2, '/job/[jobId]'),
  e(3, '/m/admin-finance'),
  e(4, '/m/[moduleId]'),
  e(5, '/old', { retiredAt: '2026-02-01' }),
  e(6, '/job/[jobId]', { subView: 'plan' }),
  e(7, '/(tabs)'),
];
const REV = [...REG].reverse();

test('normalizePath', () => {
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath(''), '/');
  assert.equal(normalizePath('/index'), '/');
  assert.equal(normalizePath('(tabs)'), '/');
  assert.equal(normalizePath('/(tabs)/jobs'), '/jobs');
  assert.equal(normalizePath('/job/abc/'), '/job/abc');
  assert.equal(normalizePath('/job/abc?x=1#y'), '/job/abc');
  assert.equal(normalizePath('/a/index'), '/a');
});

test('matchRoute', () => {
  assert.deepEqual(matchRoute('/job/[jobId]', '/job/abc'), { matched: true, dynamicCount: 1 });
  assert.equal(matchRoute('/job/[jobId]', '/job/abc/x').matched, false);
  assert.equal(matchRoute('/m/a', '/m/b').matched, false);
});

test('dynamic and extra segments', () => {
  assert.equal(resolveScreen('/job/abc', REG)?.number, 2);
  assert.equal(resolveScreen('/job/abc/extra', REG), null);
  assert.equal(resolveScreen('/nope', REG), null);
});

test('static beats dynamic, any order', () => {
  assert.equal(resolveScreen('/m/admin-finance', REG)?.number, 3);
  assert.equal(resolveScreen('/m/admin-finance', REV)?.number, 3);
  const noStatic = REG.filter((x) => x.number !== 3);
  assert.equal(resolveScreen('/m/admin-finance', noStatic)?.number, 4);
});

test('groups, index, slash, query', () => {
  assert.equal(resolveScreen('/(tabs)/jobs', REG)?.number, 1);
  assert.equal(resolveScreen('/jobs', REG)?.number, 1);
  assert.equal(resolveScreen('/', REG)?.number, 7);
  assert.equal(resolveScreen('/index', REG)?.number, 7);
  assert.equal(resolveScreen('/job/abc/', REG)?.number, 2);
  assert.equal(resolveScreen('/job/abc?x=1#y', REG)?.number, 2);
});

test('retired skipped', () => {
  assert.equal(resolveScreen('/old', REG), null);
});

test('subView override', () => {
  assert.equal(resolveScreen('/job/abc', REG, 'plan')?.number, 6);
  assert.equal(resolveScreen('/job/abc', REV, 'plan')?.number, 6);
  assert.equal(resolveScreen('/jobs', REG, 'plan')?.number, 1);
  assert.equal(resolveScreen('/job/abc', REG, null)?.number, 2);
  assert.equal(resolveScreen('/job/abc', REG, '')?.number, 2);
});

const MOD: RegistryEntry[] = [
  e(10, '/m/admin-finance', { file: 'modules/admin-finance/src/a.tsx' }),
  e(12, null, { subView: 'jobs', file: 'modules/admin-finance/src/j.tsx' }),
  e(6, '/m/field-tech', { file: 'modules/field-tech/src/a.tsx' }),
  e(25, null, { subView: 'jobs', file: 'modules/field-tech/src/j.tsx' }),
  e(38, '/m/sales-marketing', { file: 'modules/sales-marketing/src/a.tsx' }),
  e(50, null, { subView: 'leadInbox', file: 'modules/sales-marketing/src/l.tsx' }),
  e(51, null, { subView: 'gone', file: 'modules/admin-finance/src/g.tsx', retiredAt: '2026-02-01' }),
];

test('null routes do not throw or match', () => {
  assert.equal(resolveScreen('/anything', MOD), null);
  assert.equal(resolveScreen('/m/admin-finance', MOD)?.number, 10);
});

test('subView is module-scoped', () => {
  assert.equal(resolveScreen('/m/admin-finance', MOD, 'jobs')?.number, 12);
  assert.equal(resolveScreen('/m/field-tech', MOD, 'jobs')?.number, 25);
  assert.equal(resolveScreen('/m/admin-finance', [...MOD].reverse(), 'jobs')?.number, 12);
});

test('subView from another module falls back to shell', () => {
  assert.equal(resolveScreen('/m/admin-finance', MOD, 'leadInbox')?.number, 10);
});

test('subView with no base shell returns null', () => {
  assert.equal(resolveScreen('/nowhere', MOD, 'jobs'), null);
});

test('retired subView skipped', () => {
  assert.equal(resolveScreen('/m/admin-finance', MOD, 'gone')?.number, 10);
});

test('scopeOf', () => {
  assert.equal(scopeOf('modules/admin-finance/src/x.tsx'), 'modules/admin-finance');
  assert.equal(scopeOf('apps/mobile/app/job/[jobId].tsx'), 'job-detail');
  assert.equal(scopeOf('apps/mobile/app/_layout.tsx'), 'other:apps/mobile/app');
});

test('real registry sanity', () => {
  const reg = JSON.parse(
    readFileSync(new URL('../../../../apps/mobile/src/screens/screen-registry.json', import.meta.url), 'utf8'),
  ) as RegistryEntry[] | { screens: RegistryEntry[] };
  const r = Array.isArray(reg) ? reg : reg.screens;
  assert.equal(resolveScreen('/m/admin-finance', r, 'jobs')?.number, 12);
  assert.equal(resolveScreen('/m/field-tech', r, 'jobs')?.number, 25);
  assert.equal(resolveScreen('/m/admin-finance', r, 'overview')?.number, 13);
  assert.equal(resolveScreen('/m/field-tech', r, 'overview')?.number, 54);
  assert.equal(resolveScreen('/m/sales-marketing', r, 'Overview')?.number, 74);
  assert.equal(resolveScreen('/m/admin-finance', r)?.number, 10);
  assert.equal(resolveScreen('/m/field-tech', r)?.number, 6);
  assert.equal(resolveScreen('/m/sales-marketing', r)?.number, 38);
  assert.equal(resolveScreen('/m/admin-finance', r, 'paymentReview')?.number, 89);
  assert.equal(resolveScreen('/m/admin-finance', r, 'Payroll')?.number, 88);
  assert.equal(resolveScreen('/m/admin-finance', r, 'PayrollRun')?.number, 87);
  assert.equal(resolveScreen('/m/admin-finance', r, 'PayrollSettings')?.number, 86);
  assert.equal(resolveScreen('/m/admin-finance', r, 'payments')?.number, 63);
});

test('scopeOf maps payment-review into admin-finance', () => {
  assert.equal(scopeOf('modules/payment-review/src/screens/ReconciliationView.tsx'), 'modules/admin-finance');
  assert.equal(scopeOf('modules/admin-finance/src/x.tsx'), 'modules/admin-finance');
  assert.equal(scopeOf('modules/sales-marketing/src/x.tsx'), 'modules/sales-marketing');
});

test('paymentReview subView resolves under admin-finance shell', () => {
  const fx: RegistryEntry[] = [
    e(10, '/m/admin-finance', { file: 'modules/admin-finance/src/a.tsx' }),
    e(89, null, { subView: 'paymentReview', file: 'modules/payment-review/src/screens/ReconciliationView.tsx' }),
  ];
  assert.equal(resolveScreen('/m/admin-finance', fx, 'paymentReview')?.number, 89);
  assert.equal(resolveScreen('/m/admin-finance', fx, undefined)?.number, 10);
});

test('lowest number tie-break', () => {
  const t = [e(9, '/x/[a]'), e(8, '/x/[b]')];
  assert.equal(resolveScreen('/x/1', t)?.number, 8);
  assert.equal(resolveScreen('/x/1', [...t].reverse())?.number, 8);
});

test('retiredInto fallback', () => {
  const RI = [
    e(10, '/target'),
    e(11, '/gone/[id]', { retiredAt: '2026-10-16', retiredInto: 10 }),
    e(12, '/dangling/[id]', { retiredAt: '2026-10-16', retiredInto: 999 }),
    e(13, '/plain', { retiredAt: '2026-10-16' }),
    e(14, '/live/[id]'),
    e(15, '/live/[id]', { retiredAt: '2026-10-16', retiredInto: 10 }),
  ];
  for (const reg of [RI, [...RI].reverse()]) {
    assert.equal(resolveScreen('/gone/7', reg)?.number, 10);
    assert.equal(resolveScreen('/dangling/7', reg), null);
    assert.equal(resolveScreen('/plain', reg), null);
    assert.equal(resolveScreen('/live/7', reg)?.number, 14);
  }
});
