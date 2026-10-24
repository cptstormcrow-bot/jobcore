/**
 * Assertions for per-job tech pay lines (job-pay.ts).
 *
 * Runs under `node --experimental-strip-types --test` — no DB, network, env
 * vars or clock. All money values are INTEGER CENTS.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeJobPayLines, type JobPayPolicy, type JobPayTech } from '../job-pay';

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
