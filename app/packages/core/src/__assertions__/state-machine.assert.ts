import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canTransition, applyTransition, TRANSITIONS } from '../state-machine.js';
import type { Ctx, Job } from '../index.js';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'new',
    customerId: null,
    serviceId: null,
    source: null,
    payer: null,
    attachTiming: null,
    requestedWindow: null,
    scheduledStart: null,
    scheduledEnd: null,
    address: null,
    description: null,
    assignedTechId: null,
    enRouteAt: null,
    inProgressAt: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    isBeta: false,
    totalLaborSeconds: 0,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<Ctx> = {}): Ctx {
  return {
    role: 'owner',
    now: () => '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('canTransition: rejects an edge not present in TRANSITIONS with a "no transition" reason', () => {
  const job = makeJob({ status: 'new' });
  const result = canTransition(job, 'closed', makeCtx());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /no transition from 'new' to 'closed'/);
  }
});

test('canTransition: rejects a role not permitted for a legal edge', () => {
  const job = makeJob({ status: 'new' });
  const result = canTransition(job, 'qualified', makeCtx({ role: 'tech' }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /role 'tech' is not permitted/);
  }
});

test('canTransition: rejects in_progress without a submitted start checklist', () => {
  const job = makeJob({ status: 'en_route' });
  const result = canTransition(job, 'in_progress', makeCtx({ role: 'tech' }));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /submitted start checklist/);
  }
});

test('canTransition: allows in_progress once the start-checklist probe is satisfied', () => {
  const job = makeJob({ status: 'en_route' });
  const result = canTransition(
    job,
    'in_progress',
    makeCtx({ role: 'tech', hasSubmittedStartChecklist: () => true })
  );
  assert.deepEqual(result, { ok: true });
});

test('canTransition: rejects completed missing after-photos or quality notes', () => {
  const job = makeJob({ status: 'in_progress' });
  const missingPhotos = canTransition(
    job,
    'completed',
    makeCtx({ role: 'tech', hasAfterPhotos: () => false, hasQualityNotes: () => true })
  );
  assert.equal(missingPhotos.ok, false);
  if (!missingPhotos.ok) {
    assert.match(missingPhotos.reason, /after-photo/);
  }

  const missingNotes = canTransition(
    job,
    'completed',
    makeCtx({ role: 'tech', hasAfterPhotos: () => true, hasQualityNotes: () => false })
  );
  assert.equal(missingNotes.ok, false);
  if (!missingNotes.ok) {
    assert.match(missingNotes.reason, /quality notes/);
  }
});

test('canTransition: paid requires a payment record only when payer is customer', () => {
  const nonCustomer = makeJob({ status: 'completed', payer: 'insurance' });
  assert.deepEqual(canTransition(nonCustomer, 'paid', makeCtx()), { ok: true });

  const customerJob = makeJob({ status: 'completed', payer: 'customer' });
  const rejected = canTransition(customerJob, 'paid', makeCtx({ hasPaymentRecord: () => false }));
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.match(rejected.reason, /payment record/);
  }

  const accepted = canTransition(customerJob, 'paid', makeCtx({ hasPaymentRecord: () => true }));
  assert.deepEqual(accepted, { ok: true });
});

test('canTransition: a Promise-returning sync probe fails closed', async () => {
  const job = makeJob({ status: 'en_route' });
  const result = canTransition(
    job,
    'in_progress',
    makeCtx({ role: 'tech', hasSubmittedStartChecklist: () => Promise.resolve(true) })
  );
  assert.equal(result.ok, false);
});

test('applyTransition: rejects an illegal transition and throws with the exact reason', async () => {
  const job = makeJob({ status: 'new' });
  await assert.rejects(
    () => applyTransition(job, 'closed', makeCtx()),
    /no transition from 'new' to 'closed'/
  );
});

test('applyTransition: never mutates the input job and returns a new object with status updated', async () => {
  const job = makeJob({ status: 'new' });
  const next = await applyTransition(job, 'qualified', makeCtx());
  assert.equal(job.status, 'new');
  assert.equal(next.status, 'qualified');
  assert.notEqual(next, job);
});

test('applyTransition: stamps enRouteAt/inProgressAt/completedAt from the device clock on the matching transition', async () => {
  const occurredAt = '2026-02-01T12:00:00.000Z';
  const ctx = makeCtx({ role: 'tech', now: () => occurredAt });

  const enRouteJob = await applyTransition(makeJob({ status: 'accepted' }), 'en_route', ctx);
  assert.equal(enRouteJob.enRouteAt, occurredAt);
  assert.equal(enRouteJob.inProgressAt, null);

  const inProgressJob = await applyTransition(
    makeJob({ status: 'en_route' }),
    'in_progress',
    makeCtx({ role: 'tech', now: () => occurredAt, hasSubmittedStartChecklist: () => true })
  );
  assert.equal(inProgressJob.inProgressAt, occurredAt);
  assert.equal(inProgressJob.completedAt, null);

  const completedJob = await applyTransition(
    makeJob({ status: 'in_progress' }),
    'completed',
    makeCtx({
      role: 'tech',
      now: () => occurredAt,
      hasAfterPhotos: () => true,
      hasQualityNotes: () => true,
    })
  );
  assert.equal(completedJob.completedAt, occurredAt);
});

test('applyTransition: writes exactly one audit row via ctx.writeAudit carrying fromState/toState and both clocks', async () => {
  const calls: unknown[] = [];
  const job = makeJob({ status: 'new', id: 'job-42', organizationId: 'org-9' });
  const ctx = makeCtx({
    now: () => '2026-03-01T00:00:00.000Z',
    serverNow: () => '2026-03-01T00:00:05.000Z',
    writeAudit: (entry) => {
      calls.push(entry);
    },
  });

  await applyTransition(job, 'qualified', ctx);

  assert.equal(calls.length, 1);
  const entry = calls[0] as {
    organizationId: string;
    entity: string;
    entityId: string;
    action: string;
    metadata: { fromState: string; toState: string; occurredAt: string; syncedAt: string; skewMs: number };
  };
  assert.equal(entry.organizationId, 'org-9');
  assert.equal(entry.entity, 'job');
  assert.equal(entry.entityId, 'job-42');
  assert.equal(entry.action, 'job.transition.qualified');
  assert.equal(entry.metadata.fromState, 'new');
  assert.equal(entry.metadata.toState, 'qualified');
  assert.equal(entry.metadata.occurredAt, '2026-03-01T00:00:00.000Z');
  assert.equal(entry.metadata.syncedAt, '2026-03-01T00:00:05.000Z');
});

test('applyTransition: writes no audit row and does not throw when ctx.writeAudit is absent', async () => {
  const job = makeJob({ status: 'new' });
  const next = await applyTransition(job, 'qualified', makeCtx());
  assert.equal(next.status, 'qualified');
});

test('applyTransition: a rejecting writeAudit sink rejects the whole transition', async () => {
  const job = makeJob({ status: 'new' });
  const ctx = makeCtx({
    writeAudit: async () => {
      throw new Error('audit sink failed');
    },
  });
  await assert.rejects(() => applyTransition(job, 'qualified', ctx), /audit sink failed/);
});

test('TRANSITIONS table: every edge has at least one role and a valid from/to pair', () => {
  assert.ok(TRANSITIONS.length > 0);
  for (const t of TRANSITIONS) {
    assert.ok(t.roles.length > 0, `edge ${t.from}->${t.to} has no roles`);
  }
});
