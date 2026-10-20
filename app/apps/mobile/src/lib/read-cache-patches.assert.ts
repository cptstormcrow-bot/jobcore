import test from 'node:test';
import assert from 'node:assert/strict';

import { OP_PATCH_SPECS, findPatchSpecs } from './read-cache-patches';

const SINGLE = 'af.assignments.getInvestigatorTechId';
const LIST = 'af.assignments.listInvestigatorTechIds';

function run(op: string, query: string, payload: any, rows: unknown, params?: any): unknown {
  const spec = OP_PATCH_SPECS.find((s) => s.op === op && s.queries.includes(query));
  assert.ok(spec, `spec missing for ${op} / ${query}`);
  return spec.patch(payload, rows, params);
}

test('remove_investigator: single clears matching job', () => {
  const op = 'job_assignment.remove_investigator';
  assert.equal(run(op, SINGLE, { jobId: 'job-1' }, 'tech-A', { jobId: 'job-1' }), null);
  assert.equal(run(op, SINGLE, { jobId: 'job-1' }, null, { jobId: 'job-1' }), null);
});
test('remove_investigator: single other job unchanged', () => {
  const op = 'job_assignment.remove_investigator';
  assert.equal(run(op, SINGLE, { jobId: 'job-1' }, 'tech-A', { jobId: 'job-2' }), 'tech-A');
});
test('remove_investigator: list removes key without mutating input', () => {
  const op = 'job_assignment.remove_investigator';
  const rows = { 'job-1': 'tech-A', 'job-2': 'tech-B' };
  const out = run(op, LIST, { jobId: 'job-1' }, rows, { jobIds: ['job-1', 'job-2'] });
  assert.deepStrictEqual(out, { 'job-2': 'tech-B' });
  assert.deepStrictEqual(rows, { 'job-1': 'tech-A', 'job-2': 'tech-B' });
});
test('remove_investigator: list with unrelated jobIds returns same reference', () => {
  const op = 'job_assignment.remove_investigator';
  const rows = { 'job-1': 'tech-A' };
  assert.strictEqual(run(op, LIST, { jobId: 'job-1' }, rows, { jobIds: ['job-3'] }), rows);
});

const CREATE = { id: 'a1', organizationId: 'o1', draft: { kind: 'investigator', jobId: 'job-1', techId: 'tech-C' } };
test('create: single sets tech', () => {
  const op = 'job_assignment.create';
  assert.equal(run(op, SINGLE, CREATE, null, { jobId: 'job-1' }), 'tech-C');
  assert.equal(run(op, SINGLE, CREATE, 'tech-A', { jobId: 'job-1' }), 'tech-C');
  assert.equal(run(op, SINGLE, CREATE, 'tech-A', { jobId: 'job-9' }), 'tech-A');
});
test('create: list adds key without mutating input', () => {
  const rows = { 'job-2': 'tech-B' };
  const out = run('job_assignment.create', LIST, CREATE, rows, { jobIds: ['job-1', 'job-2'] });
  assert.deepStrictEqual(out, { 'job-1': 'tech-C', 'job-2': 'tech-B' });
  assert.deepStrictEqual(rows, { 'job-2': 'tech-B' });
});
test('create: installer draft leaves rows unchanged', () => {
  const p = { id: 'a1', organizationId: 'o1', draft: { kind: 'installer', jobId: 'job-1', techId: 'tech-C' } };
  const rows = { 'job-2': 'tech-B' };
  assert.strictEqual(run('job_assignment.create', LIST, p, rows, { jobIds: ['job-1'] }), rows);
  assert.strictEqual(run('job_assignment.create', SINGLE, p, 'tech-A', { jobId: 'job-1' }), 'tech-A');
});
test('create: investigator draft without techId leaves rows unchanged', () => {
  const p = { id: 'a1', organizationId: 'o1', draft: { kind: 'investigator', jobId: 'job-1', techId: undefined } };
  const rows = { 'job-2': 'tech-B' };
  assert.strictEqual(run('job_assignment.create', LIST, p, rows, { jobIds: ['job-1'] }), rows);
  assert.strictEqual(run('job_assignment.create', SINGLE, p, 'tech-A', { jobId: 'job-1' }), 'tech-A');
});

test('remove_for_job: investigator kind clears', () => {
  const op = 'job_assignment.remove_for_job';
  const p = { jobId: 'job-1', kind: 'investigator' };
  assert.equal(run(op, SINGLE, p, 'tech-A', { jobId: 'job-1' }), null);
  const rows = { 'job-1': 'tech-A', 'job-2': 'tech-B' };
  assert.deepStrictEqual(run(op, LIST, p, rows, { jobIds: ['job-1', 'job-2'] }), { 'job-2': 'tech-B' });
});
test('remove_for_job: installer kind unchanged', () => {
  const op = 'job_assignment.remove_for_job';
  const p = { jobId: 'job-1', kind: 'installer' };
  const rows = { 'job-1': 'tech-A' };
  assert.strictEqual(run(op, LIST, p, rows, { jobIds: ['job-1'] }), rows);
  assert.strictEqual(run(op, SINGLE, p, 'tech-A', { jobId: 'job-1' }), 'tech-A');
});

test('claim: two specs registered', () => {
  assert.equal(findPatchSpecs('job_assignment.claim').length, 2);
});
test('claim: premQueue spec drops the job', () => {
  const out = run('job_assignment.claim', 'ft.premQueue.listOpen', { id: 'c1', jobId: 'job-1', techId: 'tech-D' }, { items: [{ jobId: 'job-1' }, { jobId: 'job-2' }] });
  assert.deepStrictEqual(out, { items: [{ jobId: 'job-2' }] });
});
test('claim: investigator spec sets tech; missing/non-string techId unchanged', () => {
  const op = 'job_assignment.claim';
  assert.equal(run(op, SINGLE, { id: 'c1', jobId: 'job-1', techId: 'tech-D' }, null, { jobId: 'job-1' }), 'tech-D');
  assert.equal(run(op, SINGLE, { id: 'c1', jobId: 'job-1' }, 'tech-A', { jobId: 'job-1' }), 'tech-A');
  assert.equal(run(op, SINGLE, { id: 'c1', jobId: 'job-1', techId: 7 }, 'tech-A', { jobId: 'job-1' }), 'tech-A');
});

const INV_CASES: Array<[string, any]> = [
  ['job_assignment.remove_investigator', { jobId: 'job-1' }],
  ['job_assignment.create', CREATE],
  ['job_assignment.remove_for_job', { jobId: 'job-1', kind: 'investigator' }],
  ['job_assignment.claim', { id: 'c1', jobId: 'job-1', techId: 'tech-D' }],
];
test('robustness: malformed rows returned unchanged', () => {
  for (const [op, p] of INV_CASES) {
    for (const [q, params] of [[SINGLE, { jobId: 'job-1' }], [LIST, { jobIds: ['job-1'] }]] as Array<[string, any]>) {
      assert.strictEqual(run(op, q, p, 42, params), 42);
      assert.strictEqual(run(op, q, p, undefined, params), undefined);
      assert.deepStrictEqual(run(op, q, p, ['x'], params), ['x']);
    }
  }
});
test('robustness: missing or empty params leave single rows unchanged', () => {
  const op = 'job_assignment.remove_investigator';
  assert.equal(run(op, SINGLE, { jobId: 'job-1' }, 'tech-A', undefined), 'tech-A');
  assert.equal(run(op, SINGLE, { jobId: 'job-1' }, 'tech-A', {}), 'tech-A');
});
test('robustness: non-string jobId leaves rows unchanged', () => {
  for (const [op, p] of INV_CASES) {
    const bad = { ...p, jobId: 5 };
    if (op === 'job_assignment.create') bad.draft = { ...p.draft, jobId: 5 };
    assert.equal(run(op, SINGLE, bad, 'tech-A', { jobId: 5 }), 'tech-A');
    const rows = { 'job-1': 'tech-A' };
    assert.strictEqual(run(op, LIST, bad, rows, { jobIds: ['job-1'] }), rows);
  }
});
