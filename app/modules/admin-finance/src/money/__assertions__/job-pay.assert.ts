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
  devDefaultCommissionPercent: 15,
};

function tech(o: Partial<JobPayTech> = {}): JobPayTech {
  return {
    techId: 't1',
    name: 'Tech One',
    workerType: 'employee',
    techRole: 'dev',
    devPayMode: 'hourly',
    hourlyRateCents: null,
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

function devComm(o: Partial<JobPayTech>, labor?: number) {
  const l = computeJobPayLines({
    jobTotalCents: 100000,
    policy,
    techs: [tech({ devPayMode: 'commission', ...o })],
    laborTotalCents: labor,
  });
  return l;
}

test('dev commission personal percent of labor', () => {
  const l = devComm({ commissionPercent: 10 }, 24000)[0];
  assert.ok(l);
  assert.equal(l.basis, 'commission');
  assert.equal(l.amountCents, 2400);
  assert.equal(l.note, '10% of labor $240.00');
});

test('dev commission policy default when personal percent null', () => {
  const l = devComm({ commissionPercent: null }, 24000)[0];
  assert.ok(l);
  assert.equal(l.amountCents, 3600);
  assert.equal(l.note, '15% of labor $240.00 (policy default)');
});

test('dev commission: two techs each get own percent of full labor', () => {
  const lines = computeJobPayLines({
    jobTotalCents: 100000,
    policy,
    laborTotalCents: 24000,
    techs: [
      tech({ techId: 'A', devPayMode: 'commission', commissionPercent: 10 }),
      tech({ techId: 'B', devPayMode: 'commission', commissionPercent: 20 }),
    ],
  });
  assert.deepEqual(lines.map((l) => l.amountCents), [2400, 4800]);
});

test('dev commission edges: 0, 50, clamp, zero labor', () => {
  const zero = devComm({ commissionPercent: 0, commissionEnabled: false }, 24000)[0];
  assert.ok(zero);
  assert.equal(zero.basis, 'commission');
  assert.equal(zero.amountCents, 3600); // personal 0 falls back to policy 15%
  assert.equal(devComm({ commissionPercent: 50 }, 24000)[0]?.amountCents, 12000);
  assert.equal(devComm({ commissionPercent: 60 }, 24000)[0]?.amountCents, 12000);
  assert.equal(devComm({ commissionPercent: 10 }, 0)[0]?.amountCents, 0);
  const zeroPolicy = computeJobPayLines({
    jobTotalCents: 0,
    policy: { ...policy, devDefaultCommissionPercent: 0 },
    techs: [tech({ devPayMode: 'commission', commissionPercent: null })],
    laborTotalCents: 24000,
  })[0];
  assert.ok(zeroPolicy);
  assert.equal(zeroPolicy.basis, 'commission');
  assert.equal(zeroPolicy.amountCents, 0);
});

test('dev commission with commissionEnabled gets exactly one line', () => {
  const lines = devComm({ commissionPercent: 10, commissionEnabled: true }, 24000);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.amountCents, 2400);
});

test('non-dev employee with commissionEnabled still gets on-top line', () => {
  const lines = withLabor([tech({ techRole: 'prem', devPayMode: null, commissionEnabled: true, commissionPercent: 10 })], 24000);
  assert.deepEqual(lines.map((l) => l.basis), ['prem-bonus', 'commission']);
  assert.equal(lines[1]?.amountCents, 2400);
});

test('contractor dev commission computes the same amount', () => {
  const l = devComm({ workerType: 'contractor', commissionPercent: 10 }, 24000)[0];
  assert.ok(l);
  assert.equal(l.basis, 'commission');
  assert.equal(l.amountCents, 2400);
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
  const comm50 = one(tech({ techRole: null, devPayMode: 'commission', commissionPercent: 10, hourlyRateCents: 2500, hoursWorked: 2 }));
  assert.equal(comm50.basis, 'hourly');
  assert.equal(comm50.amountCents, 5000);
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
  assert.deepEqual(postable([tech({ workerType: 'contractor', devPayMode: 'commission', commissionPercent: 10 })]), []);
  assert.deepEqual(postable([tech({ workerType: 'contractor', techRole: 'prem' })]), []);
});

test('postable: zero dropped', () => {
  assert.deepEqual(postable([tech({ devPayMode: 'commission', commissionPercent: 10 })]), []);
  assert.deepEqual(postable([tech({ techRole: 'service' })]), []);
});

test('postable: dev commission maps to commission, never dev_flat', () => {
  const rows = postableJobPayLines(
    withLabor([tech({ devPayMode: 'commission', commissionPercent: 10 })], 24000),
  );
  assert.deepEqual(rows, [{ techId: 't1', amountCents: 2400, basis: 'commission' }]);
  assert.ok(!rows.some((r) => (r.basis as string) === 'dev_flat'));
});

test('postable: prem kept as prem_bonus', () => {
  assert.deepEqual(postable([tech({ techRole: 'prem', devPayMode: null })]), [
    { techId: 't1', amountCents: 15000, basis: 'prem_bonus' },
  ]);
});

test('postable: mixed list preserves order', () => {
  const rows = postableJobPayLines(
    withLabor(
      [
        tech({ techId: 'a', techRole: 'prem', devPayMode: null }),
        tech({ techId: 'b', hoursWorked: 2 }),
        tech({ techId: 'c', devPayMode: 'commission', commissionPercent: 10 }),
        tech({ techId: 'd', workerType: 'contractor', techRole: 'prem' }),
      ],
      24000,
    ),
  );
  assert.deepEqual(rows.map((r) => r.techId), ['a', 'c']);
  assert.deepEqual(rows.map((r) => r.basis), ['prem_bonus', 'commission']);
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

test('commission: hourly dev with commission gets hourly line then on-top commission', () => {
  const lines = withLabor([tech({ hourlyRateCents: 2500, hoursWorked: 2, ...comm })], 100000);
  assert.deepEqual(lines.map((l) => l.basis), ['hourly', 'commission']);
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

test('postable: prem plus on-top commission pair yields prem_bonus then commission', () => {
  const rows = postableJobPayLines(
    withLabor([tech({ techRole: 'prem', devPayMode: null, ...comm })], 100000),
  );
  assert.deepEqual(rows, [
    { techId: 't1', amountCents: 15000, basis: 'prem_bonus' },
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
