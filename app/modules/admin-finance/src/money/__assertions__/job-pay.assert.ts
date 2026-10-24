/**
 * Assertions for per-job tech pay lines (job-pay.ts).
 *
 * Runs under `node --experimental-strip-types --test` — no DB, network, env
 * vars or clock. All money values are INTEGER CENTS.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeJobPayLines, postableJobPayLines, type JobPayPolicy, type JobPayTech } from '../job-pay';

const policy: JobPayPolicy = {
  hourlyRateCents: 2000,
  premBonusFlatCents: 5000,
  premBonusPercent: 10,
  devDefaultFlatCents: 7500,
};

function tech(o: Partial<JobPayTech> = {}): JobPayTech {
  return {
    techId: 't1',
    name: 'Tech One',
    workerType: 'employee',
    techRole: 'dev',
    devPayMode: 'hourly',
    hourlyRateCents: null,
    flatRateCents: null,
    hoursWorked: 0,
    ...o,
  };
}

function one(t: JobPayTech, jobTotalCents = 100000) {
  const l = computeJobPayLines({ jobTotalCents, policy, techs: [t] })[0];
  assert.ok(l);
  return l;
}

test('dev hourly uses tech rate', () => {
  const l = one(tech({ hourlyRateCents: 2500, hoursWorked: 2 }));
  assert.equal(l.basis, 'hourly');
  assert.equal(l.amountCents, 5000);
  assert.equal(l.note, '2.00 h x $25.00/h');
});

test('dev hourly falls back to policy rate', () => {
  const l = one(tech({ hourlyRateCents: null, hoursWorked: 1.5 }));
  assert.equal(l.amountCents, 3000);
  assert.equal(l.note, '1.50 h x $20.00/h');
});

test('dev hourly with zero rate everywhere', () => {
  const l = computeJobPayLines({
    jobTotalCents: 0,
    policy: { ...policy, hourlyRateCents: 0 },
    techs: [tech({ hourlyRateCents: 0, hoursWorked: 4 })],
  })[0];
  assert.ok(l);
  assert.equal(l.amountCents, 0);
  assert.equal(l.note, 'No hourly rate set');
});

test('dev flat personal', () => {
  const l = one(tech({ devPayMode: 'flat', flatRateCents: 9000 }));
  assert.equal(l.basis, 'flat');
  assert.equal(l.amountCents, 9000);
  assert.equal(l.note, 'Flat rate per assembly');
});

test('dev flat policy default', () => {
  const l = one(tech({ devPayMode: 'flat', flatRateCents: null }));
  assert.equal(l.amountCents, 7500);
  assert.equal(l.note, 'Policy default flat rate');
});

test('dev null mode behaves as hourly', () => {
  const l = one(tech({ devPayMode: null, hoursWorked: 3 }));
  assert.equal(l.basis, 'hourly');
  assert.equal(l.amountCents, 6000);
});

test('prem flat plus percent', () => {
  const l = one(tech({ techRole: 'prem', devPayMode: null }), 100000);
  assert.equal(l.basis, 'prem-bonus');
  assert.equal(l.amountCents, 15000);
  assert.equal(l.note, '$50.00 flat + 10% of job total');
});

test('prem with zero total pays flat only', () => {
  const l = one(tech({ techRole: 'prem' }), 0);
  assert.equal(l.amountCents, 5000);
});

test('service and null role are none', () => {
  assert.equal(one(tech({ techRole: 'service' })).basis, 'none');
  const l = one(tech({ techRole: null }));
  assert.equal(l.basis, 'none');
  assert.equal(l.amountCents, 0);
  assert.equal(l.note, 'No pay role set');
});

test('null role with a personal rate is paid hourly like a Dev tech', () => {
  const l = one(tech({ techRole: null, hourlyRateCents: 2500, hoursWorked: 9.2 }));
  assert.equal(l.basis, 'hourly');
  assert.equal(l.amountCents, Math.round(9.2 * 2500));
  assert.equal(l.note, '9.20 h x $25.00/h');
  const flat = one(tech({ techRole: null, devPayMode: 'flat', flatRateCents: 9000, hourlyRateCents: 2500, hoursWorked: 2 }));
  assert.equal(flat.basis, 'hourly');
  assert.equal(flat.amountCents, 5000);
});

test('null role without a positive rate is none; service with a rate is none', () => {
  assert.equal(one(tech({ techRole: null, hourlyRateCents: 0, hoursWorked: 2 })).basis, 'none');
  assert.equal(one(tech({ techRole: null, hourlyRateCents: null, hoursWorked: 2 })).basis, 'none');
  assert.equal(one(tech({ techRole: 'service', hourlyRateCents: 2500, hoursWorked: 2 })).basis, 'none');
});

test('rounding and non-finite hours', () => {
  const l = one(tech({ hourlyRateCents: 3333, hoursWorked: 1.005 }));
  assert.equal(l.amountCents, Math.round(1.005 * 3333));
  assert.equal(one(tech({ hoursWorked: Number.NaN })).amountCents, 0);
});

test('order preserved and contractor passes through', () => {
  const lines = computeJobPayLines({
    jobTotalCents: 100000,
    policy,
    techs: [
      tech({ techId: 'a', workerType: 'contractor', techRole: 'prem' }),
      tech({ techId: 'b', techRole: 'service' }),
      tech({ techId: 'c', hoursWorked: 1 }),
    ],
  });
  assert.deepEqual(lines.map((l) => l.techId), ['a', 'b', 'c']);
  const first = lines[0];
  assert.ok(first);
  assert.equal(first.workerType, 'contractor');
});

function postable(techs: JobPayTech[], jobTotalCents = 100000) {
  return postableJobPayLines(computeJobPayLines({ jobTotalCents, policy, techs }));
}

test('postable: hourly dropped', () => {
  assert.deepEqual(postable([tech({ hourlyRateCents: 2500, hoursWorked: 2 })]), []);
});

test('postable: contractor dropped', () => {
  assert.deepEqual(postable([tech({ workerType: 'contractor', devPayMode: 'flat', flatRateCents: 9000 })]), []);
  assert.deepEqual(postable([tech({ workerType: 'contractor', techRole: 'prem' })]), []);
});

test('postable: zero dropped', () => {
  assert.deepEqual(postable([tech({ devPayMode: 'flat', flatRateCents: 0 })]), []);
  assert.deepEqual(postable([tech({ techRole: 'service' })]), []);
});

test('postable: dev flat kept as dev_flat', () => {
  assert.deepEqual(postable([tech({ devPayMode: 'flat', flatRateCents: 9000 })]), [
    { techId: 't1', amountCents: 9000, basis: 'dev_flat' },
  ]);
});

test('postable: prem kept as prem_bonus', () => {
  assert.deepEqual(postable([tech({ techRole: 'prem', devPayMode: null })]), [
    { techId: 't1', amountCents: 15000, basis: 'prem_bonus' },
  ]);
});

test('postable: mixed list preserves order', () => {
  const rows = postable([
    tech({ techId: 'a', techRole: 'prem', devPayMode: null }),
    tech({ techId: 'b', hoursWorked: 2 }),
    tech({ techId: 'c', devPayMode: 'flat', flatRateCents: 9000 }),
    tech({ techId: 'd', workerType: 'contractor', techRole: 'prem' }),
  ]);
  assert.deepEqual(rows.map((r) => r.techId), ['a', 'c']);
  assert.deepEqual(rows.map((r) => r.basis), ['prem_bonus', 'dev_flat']);
});

test('postable: empty in gives empty out', () => {
  assert.deepEqual(postableJobPayLines([]), []);
});

function withLabor(techs: JobPayTech[], laborTotalCents?: number, jobTotalCents = 100000) {
  return computeJobPayLines({ jobTotalCents, policy, techs, laborTotalCents });
}

const comm = { commissionEnabled: true, commissionPercent: 5 } as const;

test('commission: hourly employee gets normal line then commission line', () => {
  const lines = withLabor([tech({ hourlyRateCents: 2500, hoursWorked: 2, ...comm })], 100000);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.basis, 'hourly');
  assert.equal(lines[0]?.amountCents, 5000);
  assert.equal(lines[1]?.basis, 'commission');
  assert.equal(lines[1]?.amountCents, 5000);
  assert.ok(lines[1]?.note.includes('5% of labor $1000.00'));
});

test('commission: prem employee order is prem-bonus then commission', () => {
  const lines = withLabor(
    [tech({ techRole: 'prem', devPayMode: null, commissionEnabled: true, commissionPercent: 10 })],
    50000,
  );
  assert.deepEqual(lines.map((l) => l.basis), ['prem-bonus', 'commission']);
  assert.equal(lines[1]?.amountCents, 5000);
});

test('commission: flat dev keeps flat line and adds commission', () => {
  const lines = withLabor([tech({ devPayMode: 'flat', flatRateCents: 9000, ...comm })], 100000);
  assert.deepEqual(lines.map((l) => l.basis), ['flat', 'commission']);
  assert.equal(lines[0]?.amountCents, 9000);
  assert.equal(lines[1]?.amountCents, 5000);
});

test('commission: role-less no-rate employee gets none line then commission', () => {
  const lines = withLabor([tech({ techRole: null, ...comm })], 100000);
  assert.deepEqual(lines.map((l) => l.basis), ['none', 'commission']);
  assert.equal(lines[1]?.amountCents, 5000);
});

test('commission: disabled, undefined, zero or null percent gives no commission line', () => {
  assert.equal(withLabor([tech({ commissionEnabled: false, commissionPercent: 5 })], 100000).length, 1);
  assert.equal(withLabor([tech({ commissionPercent: 5 })], 100000).length, 1);
  assert.equal(withLabor([tech({ commissionEnabled: true, commissionPercent: 0 })], 100000).length, 1);
  assert.equal(withLabor([tech({ commissionEnabled: true, commissionPercent: null })], 100000).length, 1);
});

test('commission: contractor never gets a commission line', () => {
  assert.equal(withLabor([tech({ workerType: 'contractor', ...comm })], 100000).length, 1);
});

test('commission: omitted or negative labor gives a zero-amount commission line', () => {
  const omitted = withLabor([tech({ ...comm })]);
  assert.equal(omitted.length, 2);
  assert.equal(omitted[1]?.basis, 'commission');
  assert.equal(omitted[1]?.amountCents, 0);
  const neg = withLabor([tech({ ...comm })], -5000);
  assert.equal(neg.length, 2);
  assert.equal(neg[1]?.amountCents, 0);
});

test('commission: rounds to whole cents', () => {
  const lines = withLabor([tech({ commissionEnabled: true, commissionPercent: 7.5 })], 12345);
  assert.equal(lines[1]?.amountCents, 926);
});

test('commission: two techs keep order A, A-commission, B', () => {
  const lines = withLabor(
    [tech({ techId: 'A', ...comm }), tech({ techId: 'B' })],
    100000,
  );
  assert.deepEqual(lines.map((l) => `${l.techId}:${l.basis}`), ['A:hourly', 'A:commission', 'B:hourly']);
});

test('postable: flat plus commission pair yields dev_flat then commission', () => {
  const rows = postableJobPayLines(
    withLabor([tech({ devPayMode: 'flat', flatRateCents: 9000, ...comm })], 100000),
  );
  assert.deepEqual(rows, [
    { techId: 't1', amountCents: 9000, basis: 'dev_flat' },
    { techId: 't1', amountCents: 5000, basis: 'commission' },
  ]);
});

test('postable: zero commission, contractor commission and hourly are dropped', () => {
  assert.deepEqual(
    postableJobPayLines(withLabor([tech({ techRole: 'service', ...comm })], 0)),
    [],
  );
  assert.deepEqual(
    postableJobPayLines([
      {
        techId: 'c',
        name: 'C',
        workerType: 'contractor',
        techRole: 'dev',
        basis: 'commission',
        amountCents: 5000,
        note: 'x',
      },
    ]),
    [],
  );
  assert.deepEqual(postableJobPayLines(withLabor([tech({ hourlyRateCents: 2500, hoursWorked: 2 })])), []);
});
