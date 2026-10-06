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

test('all incomplete is gray, length 15', () => {
  const r = deriveStageStates(inputs());
  assert.equal(r.length, 15);
  assert.ok(r.every((s) => s.state === 'gray' && s.doneAt === null));
});

test('complete is green and carries doneAt', () => {
  const r = deriveStageStates(inputs({ lead: { complete: true, completedAt: '2026-01-01T00:00:00Z' } }));
  assert.equal(r[0]?.state, 'green');
  assert.equal(r[0]?.doneAt, '2026-01-01T00:00:00Z');
});

test('upstream change after completion is yellow', () => {
  const i = inputs({
    lead: { complete: true, completedAt: '2026-01-01T00:00:00Z', changedAt: '2026-01-05T00:00:00Z' },
    job: { complete: true, completedAt: '2026-01-02T00:00:00Z' },
  });
  assert.equal(stateOf(i, 'lead'), 'green');
  assert.equal(stateOf(i, 'job'), 'yellow');
});

test('missingRequired is yellow', () => {
  assert.equal(stateOf(inputs({ lead: { complete: true, missingRequired: true } }), 'lead'), 'yellow');
});

test('incomplete with a later stage complete is red', () => {
  const i = inputs({ estimate: { complete: true } });
  assert.equal(stateOf(i, 'lead'), 'red');
  assert.equal(stateOf(i, 'approval'), 'gray');
});

test('premAvailable inProgress: yellow, red without it, green when complete', () => {
  const later = { estimate: { complete: true } };
  assert.equal(stateOf(inputs({ ...later, premAvailable: { complete: false, inProgress: true } }), 'premAvailable'), 'yellow');
  assert.equal(stateOf(inputs({ ...later, premAvailable: { complete: false, inProgress: false } }), 'premAvailable'), 'red');
  assert.equal(stateOf(inputs({ ...later }), 'premAvailable'), 'red');
  assert.equal(stateOf(inputs({ ...later, premAvailable: { complete: true, inProgress: true } }), 'premAvailable'), 'green');
});

test('leadingIndex', () => {
  assert.equal(leadingIndex(deriveStageStates(inputs())), -1);
  const i = inputs({ lead: { complete: true }, job: { complete: true } });
  assert.equal(leadingIndex(deriveStageStates(i)), 1);
});

test('next step ordering: red, then yellow, then gray', () => {
  const g = deriveNextStep(deriveStageStates(inputs({ lead: { complete: true }, job: { complete: true } })));
  assert.equal(g, 'Next Steps: Check Prem availability.');
  const y = deriveNextStep(deriveStageStates(inputs({ lead: { complete: true, missingRequired: true } })));
  assert.equal(y, 'Next Steps: Review Lead.');
  const r = deriveNextStep(deriveStageStates(inputs({ lead: { complete: true, missingRequired: true }, schedule: { complete: true } })));
  assert.equal(r, 'Next Steps: Redo Job.');
});

test('all done', () => {
  const all = inputs();
  for (const k of STAGE_KEYS) all[k] = { complete: true };
  assert.equal(deriveNextStep(deriveStageStates(all)), 'Next Steps: All done.');
});
