import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STAGE_KEYS, deriveStageStates, leadingIndex, deriveNextStep } from '../jobStages.js';
import type { StageInputs, StageInput } from '../jobStages.js';

function inputs(over: Partial<Record<(typeof STAGE_KEYS)[number], StageInput>> = {}): StageInputs {
  const base = {} as StageInputs;
  for (const k of STAGE_KEYS) base[k] = { complete: false };
  return { ...base, ...over };
}

const stateOf = (i: StageInputs, key: (typeof STAGE_KEYS)[number]) =>
  deriveStageStates(i).find((s) => s.key === key)!.state;

test('all incomplete is gray, length 11', () => {
  const r = deriveStageStates(inputs());
  assert.equal(r.length, 11);
  assert.ok(r.every((s) => s.state === 'gray' && s.doneAt === null));
});

test('complete is green and carries doneAt', () => {
  const r = deriveStageStates(inputs({ job: { complete: true, completedAt: '2026-01-01T00:00:00Z' } }));
  assert.equal(r[0]?.state, 'green');
  assert.equal(r[0]?.doneAt, '2026-01-01T00:00:00Z');
});

test('upstream change after completion is yellow', () => {
  const i = inputs({
    job: { complete: true, completedAt: '2026-01-01T00:00:00Z', changedAt: '2026-01-05T00:00:00Z' },
    estimate: { complete: true, completedAt: '2026-01-02T00:00:00Z' },
  });
  assert.equal(stateOf(i, 'job'), 'green');
  assert.equal(stateOf(i, 'estimate'), 'yellow');
});

test('sticky stages stay green after a later upstream change', () => {
  const i = inputs({
    job: { complete: true, completedAt: '2026-01-01T00:00:00Z', changedAt: '2026-01-05T00:00:00Z' },
    prem: { complete: true, completedAt: '2026-01-02T00:00:00Z', sticky: true },
    estimate: { complete: true, completedAt: '2026-01-02T00:00:00Z', sticky: true },
    approval: { complete: true, completedAt: '2026-01-02T00:00:00Z', sticky: true },
    paid: { complete: true, completedAt: '2026-01-02T00:00:00Z' },
  });
  assert.equal(stateOf(i, 'prem'), 'green');
  assert.equal(stateOf(i, 'estimate'), 'green');
  assert.equal(stateOf(i, 'approval'), 'green');
  assert.equal(stateOf(i, 'paid'), 'yellow');
});

test('missingRequired is yellow', () => {
  assert.equal(stateOf(inputs({ job: { complete: true, missingRequired: true } }), 'job'), 'yellow');
});

test('incomplete with a later stage complete is red', () => {
  const i = inputs({ estimate: { complete: true } });
  assert.equal(stateOf(i, 'job'), 'red');
  assert.equal(stateOf(i, 'approval'), 'gray');
});

test('prem inProgress: yellow, red without it, green when complete', () => {
  const later = { estimate: { complete: true } };
  assert.equal(stateOf(inputs({ ...later, prem: { complete: false, inProgress: true } }), 'prem'), 'yellow');
  assert.equal(stateOf(inputs({ ...later, prem: { complete: false, inProgress: false } }), 'prem'), 'red');
  assert.equal(stateOf(inputs({ ...later }), 'prem'), 'red');
  assert.equal(stateOf(inputs({ ...later, prem: { complete: true, inProgress: true } }), 'prem'), 'green');
});

test('leadingIndex', () => {
  assert.equal(leadingIndex(deriveStageStates(inputs())), -1);
  const i = inputs({ job: { complete: true }, prem: { complete: true } });
  assert.equal(leadingIndex(deriveStageStates(i)), 1);
});

test('next step ordering: red, then yellow, then gray', () => {
  const g = deriveNextStep(deriveStageStates(inputs({ job: { complete: true } })));
  assert.equal(g, 'Next Steps: Complete Prem.');
  const y = deriveNextStep(deriveStageStates(inputs({ job: { complete: true, missingRequired: true } })));
  assert.equal(y, 'Next Steps: Review Job (info missing).');
  const r = deriveNextStep(deriveStageStates(inputs({ job: { complete: true, missingRequired: true }, schedule: { complete: true } })));
  assert.equal(r, 'Next Steps: Redo Prem.');
});

test('yellow next step names the earlier stage that changed', () => {
  const states = deriveStageStates(inputs({
    job: { complete: true, changedAt: '2026-02-01T00:00:00Z' },
    prem: { complete: true, completedAt: '2026-01-01T00:00:00Z' },
  }));
  const prem = states.find((s) => s.key === 'prem');
  assert.equal(prem?.reason, 'changed');
  assert.equal(prem?.changedBy, 'job');
  assert.equal(deriveNextStep(states), 'Next Steps: Review Prem (Job changed).');
  const sticky = deriveStageStates(inputs({
    job: { complete: true, changedAt: '2026-02-01T00:00:00Z' },
    prem: { complete: true, completedAt: '2026-01-01T00:00:00Z', sticky: true },
  }));
  assert.equal(sticky.find((s) => s.key === 'prem')?.state, 'green');
});

const rejectedPrefix = () =>
  inputs({
    job: { complete: true, completedAt: '2026-01-01T00:00:00Z' },
    prem: { complete: true, completedAt: '2026-01-01T00:00:00Z' },
    estimate: { complete: false, rejected: true },
    approval: { complete: false, rejected: true },
  });

test('rejected estimate and approval are red with no doneAt', () => {
  const r = deriveStageStates(rejectedPrefix());
  const est = r.find((s) => s.key === 'estimate')!;
  const app = r.find((s) => s.key === 'approval')!;
  assert.equal(est.state, 'red');
  assert.equal(app.state, 'red');
  assert.equal(est.doneAt, null);
  assert.equal(app.doneAt, null);
});

test('rejected wins over complete', () => {
  const r = deriveStageStates(
    inputs({ estimate: { complete: true, completedAt: '2026-01-01T00:00:00Z', rejected: true } }),
  );
  const est = r.find((s) => s.key === 'estimate')!;
  assert.equal(est.state, 'red');
  assert.equal(est.doneAt, null);
});

test('rejected stage drives Redo next step', () => {
  assert.equal(deriveNextStep(deriveStageStates(rejectedPrefix())), 'Next Steps: Redo Estimate.');
});

test('leadingIndex ignores red rejected dots', () => {
  assert.equal(leadingIndex(deriveStageStates(rejectedPrefix())), 1);
});

test('non-rejected complete estimate stays green (regression guard)', () => {
  const i = inputs({
    job: { complete: true, completedAt: '2026-01-01T00:00:00Z' },
    prem: { complete: true, completedAt: '2026-01-01T00:00:00Z' },
    estimate: { complete: true },
  });
  assert.equal(stateOf(i, 'estimate'), 'green');
  assert.equal(stateOf(i, 'approval'), 'gray');
  assert.equal(leadingIndex(deriveStageStates(i)), 2);
});

test('all done', () => {
  const all = inputs();
  for (const k of STAGE_KEYS) all[k] = { complete: true };
  assert.equal(deriveNextStep(deriveStageStates(all)), 'Next Steps: All done.');
});

const premJobBumped = (prem: StageInput) =>
  inputs({
    job: { complete: true, completedAt: '2026-01-01T00:00:00Z', changedAt: '2026-01-05T00:00:00Z' },
    prem,
  });

test('sticky complete stage stays green despite a later upstream change', () => {
  const done = { complete: true, completedAt: '2026-01-02T00:00:00Z' };
  assert.equal(stateOf(premJobBumped({ ...done, sticky: true }), 'prem'), 'green');
  assert.equal(stateOf(premJobBumped(done), 'prem'), 'yellow');
});

test('sticky contact/startWork/completeWork stay green after a later upstream change; non-sticky paid goes yellow', () => {
  const done = { complete: true, completedAt: '2026-01-02T00:00:00Z' };
  const i = inputs({
    job: { complete: true, completedAt: '2026-01-01T00:00:00Z', changedAt: '2026-01-05T00:00:00Z' },
    contact: { ...done, sticky: true },
    startWork: { ...done, sticky: true },
    completeWork: { ...done, sticky: true },
    paid: done,
  });
  assert.equal(stateOf(i, 'contact'), 'green');
  assert.equal(stateOf(i, 'startWork'), 'green');
  assert.equal(stateOf(i, 'completeWork'), 'green');
  assert.equal(stateOf(i, 'paid'), 'yellow');
});

test('sticky does not hide missingRequired or rescue a rejected stage', () => {
  const done = { complete: true, completedAt: '2026-01-02T00:00:00Z', sticky: true };
  assert.equal(stateOf(premJobBumped({ ...done, missingRequired: true }), 'prem'), 'yellow');
  const rej = deriveStageStates(premJobBumped({ ...done, rejected: true })).find((s) => s.key === 'prem')!;
  assert.equal(rej.state, 'red');
  assert.equal(rej.doneAt, null);
});

test('notRequired incomplete stage with a later stage complete is gray, not red', () => {
  const i = inputs({
    job: { complete: true },
    prem: { complete: false, notRequired: true },
    estimate: { complete: true },
  });
  assert.equal(stateOf(i, 'prem'), 'gray');
  assert.deepEqual(deriveStageStates(i).filter((s) => s.notRequired).map((s) => s.key), ['prem']);
  assert.equal(stateOf(i, 'job'), 'green');
});

test('inProgress beats notRequired', () => {
  const i = inputs({
    estimate: { complete: true },
    prem: { complete: false, inProgress: true, notRequired: true },
  });
  const p = deriveStageStates(i).find((s) => s.key === 'prem')!;
  assert.equal(p.state, 'yellow');
  assert.equal(p.notRequired, undefined);
});

test('next step skips a notRequired gray stage', () => {
  const base = { job: { complete: true } };
  assert.equal(
    deriveNextStep(deriveStageStates(inputs({ ...base, prem: { complete: false, notRequired: true } }))),
    'Next Steps: Build the estimate.',
  );
  assert.equal(
    deriveNextStep(deriveStageStates(inputs({ ...base, prem: { complete: false } }))),
    'Next Steps: Complete Prem.',
  );
});

test('next step names the roadblock when the next stage is blocked', () => {
  const over: Partial<StageInputs> = {};
  for (const k of STAGE_KEYS.slice(0, STAGE_KEYS.indexOf('startWork'))) over[k] = { complete: true };
  const states = deriveStageStates(inputs(over));
  assert.equal(deriveNextStep(states, { startWork: 'needs an installer tech' }), 'Next Steps: Start work: needs an installer tech.');
  assert.equal(deriveNextStep(states, { paid: 'needs an approved estimate' }), 'Next Steps: Start work.');
});
