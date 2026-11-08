/** Assertions for the lead-intake pure handler (jobcore-job-v1). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBody, validateLead, handleIntake, sha256Hex, resolveZip, type IntakeStore, type LeadInsert } from '../handler.ts';

const JSON_BODY = {
  format: 'jobcore-job-v1', lead_id: 'web-1', customer_name: 'Pat Rivera', customer_phone: '555-201-4488',
  customer_email: 'Pat@Example.com', address: '1901 State St, Santa Barbara, CA 93101', description: 'Shed assembly',
  source: 'website', task: 'Assy BMS7705', url: 'example.com/x.pdf', requested_window: 'Saturday morning',
  ingress_instructions: 'Side gate', is_test: false, color: 'red',
};
const CSV_BODY = 'format,lead_id,customer_name,customer_phone,address,description,source\n'
  + 'jobcore-job-v1,web-2,Pat,555,"1 A St, SB, CA 93101","Big, boxed shed",website';

const asStrings = (o: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(o).map(([a, b]) => [a, String(b)]));

function fakeStore(): IntakeStore & { rows: LeadInsert[] } {
  const rows: LeadInsert[] = [];
  return {
    rows,
    async findOrgByKeyHash(h) { return h === (await sha256Hex('secret')) ? 'org-1' : null; },
    async insertLead(r) {
      if (rows.some((x) => x.organization_id === r.organization_id && x.lead_id === r.lead_id)) return 'duplicate';
      rows.push(r); return 'inserted';
    },
  };
}
const hdr = (k?: string, ct = 'application/json') => ({
  get: (n: string) => (n === 'x-intake-key' ? k ?? null : n === 'content-type' ? ct : null),
});

test('JSON parses and validates, cleans url, keeps unknown fields in details', () => {
  const p = parseBody(JSON.stringify(JSON_BODY), 'application/json');
  assert.ok(p.ok);
  const v = validateLead(p.fields);
  assert.ok(v.ok);
  assert.equal(v.row.zip, '93101');
  assert.equal(v.row.email, 'pat@example.com');
  assert.match(v.row.project_details, /Instructions URL: https:\/\/example\.com\/x\.pdf/);
  assert.match(v.row.project_details, /color=red/);
  assert.equal(v.row.is_test, false);
});

test('single-row CSV with quoted commas parses to the same fields', () => {
  const p = parseBody(CSV_BODY, 'text/csv');
  assert.ok(p.ok);
  assert.equal(p.fields.description, 'Big, boxed shed');
  assert.ok(validateLead(p.fields).ok);
});

test('CSV with two data rows is rejected', () => {
  assert.equal(parseBody(CSV_BODY + '\nx', 'text/csv').ok, false);
});

test('missing required fields and bad source name the field', () => {
  for (const k of ['lead_id', 'customer_name', 'address', 'description', 'source']) {
    const v = validateLead({ ...asStrings(JSON_BODY), [k]: '' });
    assert.ok(!v.ok && v.error.includes(k), k);
  }
  const bad = validateLead({ ...asStrings(JSON_BODY), source: 'beta-test' });
  assert.ok(!bad.ok && bad.error.includes('source'));
});

test('phone or email is required', () => {
  const f = asStrings(JSON_BODY);
  const v = validateLead({ ...f, customer_phone: '', customer_email: '' });
  assert.ok(!v.ok && /customer_phone or customer_email/.test(v.error));
  assert.ok(validateLead({ ...f, customer_phone: '' }).ok);
});

test('zip falls back to the end of the address', () => {
  assert.equal(resolveZip('', '9 B Rd, Goleta, CA 93117-1234'), '93117');
  assert.equal(resolveZip('', 'no zip here'), null);
});

test('handleIntake: auth, insert, duplicate without a second row', async () => {
  const s = fakeStore();
  const post = (key?: string) => handleIntake({ method: 'POST', headers: hdr(key), body: JSON.stringify(JSON_BODY) }, s);
  assert.equal((await post()).status, 401);
  assert.equal((await post('wrong')).status, 401);
  const first = await post('secret');
  assert.deepEqual(first, { status: 200, body: { ok: true, lead_id: 'web-1', duplicate: false } });
  assert.equal(s.rows[0].organization_id, 'org-1');
  const second = await post('secret');
  assert.equal(second.status, 200);
  assert.equal(second.body.duplicate, true);
  assert.equal(s.rows.length, 1);
  assert.equal((await handleIntake({ method: 'GET', headers: hdr('secret'), body: '' }, s)).status, 405);
  assert.equal((await handleIntake({ method: 'POST', headers: hdr('secret'), body: '{bad' }, s)).status, 400);
});
