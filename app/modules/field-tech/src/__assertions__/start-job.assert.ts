import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyTransition } from '../../../../packages/core/src/state-machine.js';
import { buildTransitionCtxFrom, persistTransitionWith } from '../lib/transition-ctx.js';
import type { Job } from '../../../../packages/core/src/index.js';
import type { ModulePorts } from '../lib/module-ports.js';
import type { ModuleSession } from '../lib/module-session.js';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'en_route',
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
    assignedTechId: 'tech-1',
    enRouteAt: null,
    inProgressAt: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    isBeta: false,
    totalLaborSeconds: 0,
    ...overrides,
  };
}

const session = { role: 'tech', userId: 'tech-1' } as unknown as ModuleSession;

interface Spies {
  statusCalls: Array<[string, string, string]>;
  calendarCalls: unknown[][];
}

function makePorts(opts: { submitted?: boolean; checklistRejects?: boolean } = {}): {
  ports: ModulePorts;
  spies: Spies;
} {
  const spies: Spies = { statusCalls: [], calendarCalls: [] };
  const ports = {
    checklist: {
      getInstanceForJob: async () => {
        if (opts.checklistRejects) throw new Error('checklist read failed');
        return { submittedAt: opts.submitted === false ? null : '2026-01-01T00:00:00.000Z' };
      },
    },
    photos: { listForJob: async () => [] },
    notes: { listForJob: async () => [] },
    jobs: {
      updateStatusAsTech: async (id: string, techId: string, status: string) => {
        spies.statusCalls.push([id, techId, status]);
      },
    },
    calendarEvents: {
      logOwnTransition: async (...args: unknown[]) => {
        spies.calendarCalls.push(args);
      },
    },
  } as unknown as ModulePorts;
  return { ports, spies };
}

// Mirrors the 'start-job' jobAction in index.ts: ctx -> transition -> persist.
async function startJob(job: Job, ports: ModulePorts): Promise<Job> {
  const ctx = await buildTransitionCtxFrom(job, session, ports);
  const transitioned = await applyTransition(job, 'in_progress', ctx);
  await persistTransitionWith(job, transitioned, session, ports);
  return transitioned;
}

test('start job: submitted checklist probe resolves -> transition allowed and in_progress persisted', async () => {
  const { ports, spies } = makePorts({ submitted: true });
  const job = makeJob();
  const result = await startJob(job, ports);
  assert.equal(result.status, 'in_progress');
  assert.deepEqual(spies.statusCalls, [['job-1', 'tech-1', 'in_progress']]);
  assert.equal(spies.calendarCalls.length, 1);
});

test('start job: checklist not submitted -> transition rejected and nothing persisted', async () => {
  const { ports, spies } = makePorts({ submitted: false });
  await assert.rejects(() => startJob(makeJob(), ports), /submitted start checklist/);
  assert.equal(spies.statusCalls.length, 0);
  assert.equal(spies.calendarCalls.length, 0);
});

test('start job: a probe input read rejecting aborts before any persist', async () => {
  const { ports, spies } = makePorts({ checklistRejects: true });
  await assert.rejects(() => startJob(makeJob(), ports), /checklist read failed/);
  assert.equal(spies.statusCalls.length, 0);
});
