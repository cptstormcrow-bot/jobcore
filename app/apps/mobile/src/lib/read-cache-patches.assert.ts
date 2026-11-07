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

test('create_blackout: new row shows on the admin list at once, once only', () => {
  const op = 'time_off_request.create_blackout';
  const p = { id: 'b1', organizationId: 'o1', techId: 't1', draft: { startDate: '2026-11-13', endDate: '2026-11-13', reason: null } };
  const out = run(op, 'af.timeOff.listForOrganization', p, [{ id: 'old' }], { organizationId: 'o1' }) as any[];
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'b1');
  assert.equal(out[0].startDate, '2026-11-13');
  assert.equal(out[0].status, 'approved');
  assert.equal(run(op, 'af.timeOff.listForOrganization', p, out), out);
  const other = [{ id: 'x' }];
  assert.equal(run(op, 'ft.timeOff.listForTech', p, other, { techId: 't2' }), other);
});
test('admin_cancel: marks the row cancelled', () => {
  const out = run('time_off_request.admin_cancel', 'af.timeOff.listForOrganization', { requestId: 'b1' }, [{ id: 'b1', status: 'approved' }]) as any[];
  assert.equal(out[0].status, 'cancelled');
});

const LINE_ADD = { id: 'l2', jobId: 'job-1', draft: { kind: 'labor', description: 'Hang TV', quantity: 1, unitCost: 80, lineTotal: 80 } };
test('estimate line add: appends to the cached Tasks list', () => {
  const rows = [{ id: 'l1', jobId: 'job-1' }];
  const out = run('job_estimate_line_item.add', 'af.estimates.listLineItems', LINE_ADD, rows, { jobId: 'job-1' }) as any[];
  assert.equal(out.length, 2);
  assert.equal(out[1].id, 'l2');
  assert.equal(out[1].description, 'Hang TV');
});
test('estimate line add: other job and repeat add leave the list alone', () => {
  const rows = [{ id: 'l2', jobId: 'job-1' }];
  assert.strictEqual(run('job_estimate_line_item.add', 'af.estimates.listLineItems', LINE_ADD, rows, { jobId: 'job-9' }), rows);
  assert.strictEqual(run('job_estimate_line_item.add', 'af.estimates.listLineItems', LINE_ADD, rows, { jobId: 'job-1' }), rows);
});

const PHOTOS = 'af.closeOutPhotos.listForJob';
const PHOTO_ADD = { id: 'p1', jobId: 'job-1', kind: 'before', storagePath: 'org/job-1/BEF-1.jpg', localUri: 'file:///p1.jpg' };

test('job photo add: shows on the Photos tab lists for that job', () => {
  const row = { id: 'p1', storage_path: 'org/job-1/BEF-1.jpg', kind: 'before', local_uri: 'file:///p1.jpg' };
  assert.deepEqual(run('job_photo.create', PHOTOS, PHOTO_ADD, [], { jobId: 'job-1', kind: null }), [row]);
  assert.deepEqual(run('job_photo.create', PHOTOS, PHOTO_ADD, [{ id: 'p0' }], { jobId: 'job-1', kind: 'before' }), [{ id: 'p0' }, row]);
});

test('job photo add: other job, other kind and repeat add leave the list alone', () => {
  const rows = [{ id: 'p1' }];
  assert.strictEqual(run('job_photo.create', PHOTOS, PHOTO_ADD, rows, { jobId: 'job-9', kind: null }), rows);
  assert.strictEqual(run('job_photo.create', PHOTOS, PHOTO_ADD, rows, { jobId: 'job-1', kind: 'after' }), rows);
  assert.strictEqual(run('job_photo.create', PHOTOS, PHOTO_ADD, rows, { jobId: 'job-1', kind: null }), rows);
});

test('job photo remove: drops it from the Photos tab list', () => {
  assert.deepEqual(run('job_photo.remove', PHOTOS, { id: 'p1' }, [{ id: 'p0' }, { id: 'p1' }]), [{ id: 'p0' }]);
});

test('job archive and unarchive: change the status on the cached job lists', () => {
  const rows = [{ id: 'job-1', status: 'completed' }, { id: 'job-2', status: 'scheduled' }];
  const archived = run('job.archive', 'af.jobs.listForOrganization', { jobId: 'job-1', status: 'archived' }, rows);
  assert.deepEqual(archived, [{ id: 'job-1', status: 'archived' }, { id: 'job-2', status: 'scheduled' }]);
  const back = run('job.unarchive', 'af.jobs.getById', { jobId: 'job-1', status: 'closed' }, { id: 'job-1', status: 'archived' });
  assert.deepEqual(back, { id: 'job-1', status: 'closed' });
});

test('estimate fine print save: replaces the saved fine print', () => {
  const op = 'estimate_settings.fine_print_upsert';
  assert.equal(run(op, 'af.estimates.finePrint', { text: 'New terms', updatedAt: 'x' }, 'Old terms'), 'New terms');
  assert.equal(run(op, 'af.estimates.finePrint', { text: 'First terms', updatedAt: 'x' }, null), 'First terms');
});


test('job details save: address and description show on the cached job right away (snake and camel keys)', () => {
  const out = run('job.update_details', 'app.jobs.byId', { jobId: 'job-1', patch: { jobAddress: '1 Main St' } }, { id: 'job-1', job_address: 'old' }) as any;
  assert.equal(out.jobAddress, '1 Main St');
  assert.equal(out.job_address, '1 Main St');
});

test('job customer save: patches the cached customer so the header shows the new phone', () => {
  const payload = { jobId: 'job-1', customerId: 'c1', patch: { phone: '555-0100' } };
  const a = run('job_customer.save', 'app.customers.byId', payload, { id: 'c1', name: 'Ann', phone: 'old' }, { customerId: 'c1' }) as any;
  assert.deepEqual([a.name, a.phone], ['Ann', '555-0100']);
  const b = run('job_customer.save', 'af.customers.getById', payload, { id: 'c1', phone: 'old' }, { id: 'c1' }) as any;
  assert.equal(b.phone, '555-0100');
  const other = { id: 'c2', phone: 'x' };
  assert.strictEqual(run('job_customer.save', 'app.customers.byId', payload, other, { customerId: 'c2' }), other);
});

const RATES = 'af.rates.list';
const RATE = { id: 'r1', priceSheetId: 's1', serviceId: 'svc', taskId: null, attachTiming: 'pre', amount: 9500, timeEstimateMinutes: 60 };
test('price_sheet_rate.create: appends to its sheet only, once', () => {
  const op = 'price_sheet_rate.create';
  const out = run(op, RATES, RATE, [], { priceSheetId: 's1' }) as any[];
  assert.equal(out.length, 1);
  assert.equal(out[0].amount, 9500);
  assert.deepStrictEqual(run(op, RATES, RATE, out, { priceSheetId: 's1' }), out);
  const other: unknown[] = [];
  assert.strictEqual(run(op, RATES, RATE, other, { priceSheetId: 's2' }), other);
});
test('price_sheet_rate.update: edits the row in place', () => {
  const rows = [{ ...RATE, taskName: 'T' }];
  const out = run('price_sheet_rate.update', RATES, { ...RATE, amount: 12000 }, rows) as any[];
  assert.equal(out[0].amount, 12000);
  assert.equal(out[0].taskName, 'T');
});
test('price_sheet_rate.delete: drops the row', () => {
  assert.deepStrictEqual(run('price_sheet_rate.delete', RATES, { id: 'r1' }, [{ id: 'r1' }, { id: 'r2' }]), [{ id: 'r2' }]);
});
