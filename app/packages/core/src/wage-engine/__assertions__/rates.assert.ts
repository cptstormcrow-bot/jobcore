import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rateOnDate } from '../rates.js';

const H2 = [
  { effectiveFrom: '2026-01-01', hourlyRateCents: 2500 },
  { effectiveFrom: '2026-07-01', hourlyRateCents: 2800 },
];

test('rateOnDate: empty history -> null', () => {
  assert.equal(rateOnDate([], '2026-10-14'), null);
});

test('rateOnDate: date before first effectiveFrom -> null', () => {
  assert.equal(rateOnDate([H2[0]!], '2025-12-31'), null);
});

test('rateOnDate: change is inclusive on its effectiveFrom', () => {
  assert.equal(rateOnDate(H2, '2026-06-30'), 2500);
  assert.equal(rateOnDate(H2, '2026-07-01'), 2800);
});

test('rateOnDate: far-future date -> latest rate', () => {
  assert.equal(rateOnDate(H2, '2099-12-31'), 2800);
});

test('rateOnDate: mid-week change', () => {
  const h = [
    { effectiveFrom: '2026-01-01', hourlyRateCents: 2500 },
    { effectiveFrom: '2026-10-14', hourlyRateCents: 2800 },
  ];
  assert.equal(rateOnDate(h, '2026-10-12'), 2500);
  assert.equal(rateOnDate(h, '2026-10-13'), 2500);
  assert.equal(rateOnDate(h, '2026-10-14'), 2800);
  assert.equal(rateOnDate(h, '2026-10-16'), 2800);
});

const H3 = [
  { effectiveFrom: '2026-01-01', hourlyRateCents: 2500 },
  { effectiveFrom: '2026-04-01', hourlyRateCents: 2700 },
  { effectiveFrom: '2026-09-01', hourlyRateCents: 3000 },
];

test('rateOnDate: three-step history', () => {
  assert.equal(rateOnDate(H3, '2026-02-15'), 2500);
  assert.equal(rateOnDate(H3, '2026-05-15'), 2700);
  assert.equal(rateOnDate(H3, '2026-10-15'), 3000);
});

test('rateOnDate: unsorted input matches sorted input', () => {
  const unsorted = [H3[2]!, H3[0]!, H3[1]!];
  for (const d of ['2025-12-31', '2026-01-01', '2026-03-31', '2026-04-01', '2026-08-31', '2026-09-01']) {
    assert.equal(rateOnDate(unsorted, d), rateOnDate(H3, d));
  }
});

test('rateOnDate: does not mutate input', () => {
  const input = [H3[2]!, H3[0]!, H3[1]!];
  const copy = input.map((c) => ({ ...c }));
  rateOnDate(input, '2026-10-01');
  assert.deepEqual(input, copy);
});

test('rateOnDate: duplicate effectiveFrom -> later input entry wins', () => {
  const h = [
    { effectiveFrom: '2026-01-01', hourlyRateCents: 2500 },
    { effectiveFrom: '2026-01-01', hourlyRateCents: 2600 },
  ];
  assert.equal(rateOnDate(h, '2026-02-01'), 2600);
});

test('rateOnDate: epoch baseline covers any later date', () => {
  const h = [{ effectiveFrom: '1970-01-01', hourlyRateCents: 2200 }];
  assert.equal(rateOnDate(h, '1970-01-01'), 2200);
  assert.equal(rateOnDate(h, '2026-10-14'), 2200);
});

test('rateOnDate: rejects malformed dates', () => {
  assert.throws(() => rateOnDate(H2, 'not-a-date'), RangeError);
  assert.throws(() => rateOnDate(H2, '2026/10/14'), RangeError);
});
