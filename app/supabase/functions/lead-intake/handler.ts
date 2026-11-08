// supabase/functions/lead-intake/handler.ts
//
// Pure parse + validate + row-mapping for the `jobcore-job-v1` website lead
// format (spec: wiki/admin/workflows/jobcore-job-import-format.md). No Deno or
// network imports so it runs under node --test.

export const FORMAT = 'jobcore-job-v1';
export const ALLOWED_SOURCES = ['website', 'costco', 'ikea', 'owm'] as const;

export type RawFields = Record<string, string>;

export interface LeadInsert {
  organization_id: string;
  lead_id: string;
  source_form: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  preferred_date: null;
  preferred_time: string | null;
  address: string;
  project_details: string;
  source: string;
  payer: string | null;
  attach_timing: string;
  zip: string | null;
  service_area: string | null;
  ingress_instructions: string | null;
  is_test: boolean;
}

export type ParseResult =
  | { ok: true; fields: RawFields }
  | { ok: false; error: string };

export type ValidateResult =
  | { ok: true; row: Omit<LeadInsert, 'organization_id'> }
  | { ok: false; error: string };

/** Minimal RFC-4180 CSV parser (quotes, doubled quotes, CRLF). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/** Body (JSON object or single-row CSV) -> flat string map. */
export function parseBody(body: string, contentType: string): ParseResult {
  const text = body.replace(/^﻿/, '').trim();
  if (text === '') return { ok: false, error: 'Empty request body.' };
  const looksJson = contentType.toLowerCase().includes('json') || text.startsWith('{');
  if (looksJson) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { ok: false, error: 'Body is not valid JSON.' }; }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'JSON body must be one flat object.' };
    }
    const fields: RawFields = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) fields[k.trim()] = stringify(v);
    return { ok: true, fields };
  }
  const rows = parseCsvRows(text);
  if (rows.length !== 2) return { ok: false, error: 'CSV must be a header row plus exactly one data row.' };
  const fields: RawFields = {};
  rows[0].forEach((h, i) => { fields[h.trim()] = rows[1][i] ?? ''; });
  return { ok: true, fields };
}

const t = (v: string | undefined): string => (v ?? '').replace(/\s+/g, ' ').trim();
const orNull = (v: string): string | null => (v === '' ? null : v);

/** Zip from the field, else the trailing 5 digits of the address. */
export function resolveZip(zip: string, address: string): string | null {
  const direct = zip.match(/\d{5}/);
  if (direct) return direct[0];
  const tail = address.match(/(\d{5})(?:-\d{4})?\s*$/);
  return tail ? tail[1] : null;
}

const KNOWN = new Set([
  'format', 'lead_id', 'customer_name', 'customer_phone', 'customer_email', 'address', 'zip', 'service_area',
  'service', 'task', 'url', 'description', 'requested_window', 'payer', 'source', 'source_form',
  'ingress_instructions', 'is_test',
]);

function normalizeUrl(u: string): string {
  if (u === '') return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export function validateLead(fields: RawFields): ValidateResult {
  const f: RawFields = {};
  for (const [k, v] of Object.entries(fields)) f[k] = t(v);
  if (f.format !== FORMAT) return { ok: false, error: `Field "format" must be "${FORMAT}".` };
  for (const req of ['lead_id', 'customer_name', 'address', 'description', 'source'] as const) {
    if ((f[req] ?? '') === '') return { ok: false, error: `Missing required field "${req}".` };
  }
  const phone = f.customer_phone ?? '';
  const email = f.customer_email ?? '';
  if (phone === '' && email === '') return { ok: false, error: 'Provide customer_phone or customer_email.' };
  if (email !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Field "customer_email" is not a valid email address.' };
  }
  const source = f.source.toLowerCase();
  if (!(ALLOWED_SOURCES as readonly string[]).includes(source)) {
    return { ok: false, error: `Field "source" must be one of: ${ALLOWED_SOURCES.join(', ')}.` };
  }

  // Details block: description first, then optional context kept as text.
  const extra: string[] = [];
  const task = f.task ?? '';
  const url = normalizeUrl(f.url ?? '');
  if (task !== '') extra.push(`Task: ${task}`);
  if (url !== '') extra.push(`Instructions URL: ${url}`);
  if ((f.service ?? '') !== '') extra.push(`Service requested: ${f.service}`);
  if ((f.requested_window ?? '') !== '') extra.push(`Requested window: ${f.requested_window}`);
  const unknown = Object.keys(f).filter((k) => !KNOWN.has(k) && f[k] !== '');
  if (unknown.length > 0) extra.push(`Other fields: ${unknown.map((k) => `${k}=${f[k]}`).join('; ')}`);
  const projectDetails = [f.description, ...extra].join('\n');

  return {
    ok: true,
    row: {
      lead_id: f.lead_id,
      source_form: orNull(f.source_form ?? ''),
      name: f.customer_name,
      phone: orNull(phone),
      email: orNull(email.toLowerCase()),
      service: orNull(f.service ?? ''),
      preferred_date: null,
      preferred_time: orNull(f.requested_window ?? ''),
      address: f.address,
      project_details: projectDetails,
      source,
      payer: orNull(f.payer ?? ''),
      attach_timing: 'at_purchase',
      zip: resolveZip(f.zip ?? '', f.address),
      service_area: orNull(f.service_area ?? ''),
      ingress_instructions: orNull(f.ingress_instructions ?? ''),
      is_test: /^(true|1|yes)$/i.test(f.is_test ?? ''),
    },
  };
}

/** SHA-256 hex via WebCrypto (Deno and Node 20+ both have it). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Pull the secret from `x-intake-key` or `Authorization: Bearer`. */
export function extractKey(headers: { get(name: string): string | null }): string {
  const direct = headers.get('x-intake-key');
  if (direct) return direct.trim();
  const auth = headers.get('authorization') ?? '';
  return auth.replace(/^Bearer\s+/i, '').trim();
}

export interface IntakeStore {
  /** Org id for an active key hash, or null. */
  findOrgByKeyHash(hash: string): Promise<string | null>;
  /** Insert; returns 'inserted' or 'duplicate' (unique lead_id hit). */
  insertLead(row: LeadInsert): Promise<'inserted' | 'duplicate'>;
}

export interface IntakeResponse { status: number; body: Record<string, unknown> }

/** Whole request flow over an injected store (testable without a DB). */
export async function handleIntake(
  req: { method: string; headers: { get(name: string): string | null }; body: string },
  store: IntakeStore,
): Promise<IntakeResponse> {
  if (req.method !== 'POST') return { status: 405, body: { ok: false, error: 'POST only.' } };
  const key = extractKey(req.headers);
  if (key === '') return { status: 401, body: { ok: false, error: 'Missing intake key.' } };
  const orgId = await store.findOrgByKeyHash(await sha256Hex(key));
  if (!orgId) return { status: 401, body: { ok: false, error: 'Invalid intake key.' } };
  const parsed = parseBody(req.body, req.headers.get('content-type') ?? '');
  if (!parsed.ok) return { status: 400, body: { ok: false, error: parsed.error } };
  const v = validateLead(parsed.fields);
  if (!v.ok) return { status: 422, body: { ok: false, error: v.error } };
  const result = await store.insertLead({ organization_id: orgId, ...v.row });
  return { status: 200, body: { ok: true, lead_id: v.row.lead_id, duplicate: result === 'duplicate' } };
}
