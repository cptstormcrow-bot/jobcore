// Optimistic read-cache patches: each queued op patches the cached query rows it affects (pure functions).
// `queries` are exact cached query names (3rd key segment), as used by readCached(...) in the repo files.
export type OpPatchSpec = { op: string; queries: string[]; patch: (payload: Record<string, unknown>, rows: unknown) => unknown };

type Row = Record<string, unknown>;
const isObj = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Apply fn to every matching row; works for array, single object, or null. Unchanged when nothing matches. */
function mapRows(rows: unknown, match: (r: Row) => boolean, fn: (r: Row) => Row): unknown {
  if (Array.isArray(rows)) {
    let hit = false;
    const out = rows.map((r) => (isObj(r) && match(r) ? ((hit = true), fn(r)) : r));
    return hit ? out : rows;
  }
  if (isObj(rows) && match(rows)) return fn(rows);
  return rows;
}
function prepend(rows: unknown, row: Row): unknown {
  if (Array.isArray(rows)) return [row, ...rows];
  return rows === null || rows === undefined ? [row] : rows;
}
function dropWhere(rows: unknown, pred: (r: Row) => boolean): unknown {
  if (!Array.isArray(rows)) return rows;
  const out = rows.filter((r) => !(isObj(r) && pred(r)));
  return out.length === rows.length ? rows : out;
}
/** Shape-aware drop: bare array, or `{ items: [...] }` payload (ft.premQueue.listOpen); anything else unchanged. */
function dropFromItems(rows: unknown, pred: (r: Row) => boolean): unknown {
  if (Array.isArray(rows)) return dropWhere(rows, pred);
  if (isObj(rows) && Array.isArray(rows.items)) return { ...rows, items: dropWhere(rows.items, pred) };
  return rows;
}
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const idIs = (id: unknown) => (r: Row) => id !== undefined && r.id === id;

const JOB_QUERIES = ['ft.jobs.listAssignedToTech', 'ft.jobs.getById', 'af.jobs.getById', 'af.jobs.listForOrganization', 'app.jobs.byId', 'app.jobs.list'];

const jobPatch = (idKey: string, apply: (p: Record<string, unknown>) => Row) => (p: Record<string, unknown>, rows: unknown) =>
  mapRows(rows, idIs(p[idKey]), (r) => ({ ...r, ...apply(p) }));

function lifecycleCols(patch: unknown): Row {
  if (!isObj(patch)) return {};
  const out: Row = { ...patch };
  for (const [k, v] of Object.entries(patch)) out[k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())] = v;
  return out;
}

export const OP_PATCH_SPECS: OpPatchSpec[] = [
  { op: 'job.updateStatusAsTech', queries: JOB_QUERIES, patch: jobPatch('jobId', (p) => ({ status: p.status })) },
  { op: 'job.update_status', queries: JOB_QUERIES, patch: jobPatch('jobId', (p) => ({ status: p.status })) },
  { op: 'job.patch_lifecycle', queries: JOB_QUERIES, patch: jobPatch('jobId', (p) => lifecycleCols(p.patch)) },
  { op: 'job.mark_contacted', queries: JOB_QUERIES, patch: jobPatch('jobId', (p) => ({ contacted_at: p.contactedAt, contactedAt: p.contactedAt })) },
  {
    op: 'job_time_entry.clock_in',
    queries: ['ft.timeEntries.listForJob'],
    patch: (p, rows) =>
      Array.isArray(rows) && rows.some((r) => isObj(r) && r.id === p.id)
        ? rows
        : prepend(rows, { id: p.id, job_id: p.jobId, jobId: p.jobId, clock_in_at: p.clockInAt, clockInAt: p.clockInAt, clock_out_at: null, clockOutAt: null }),
  },
  {
    op: 'job_time_entry.clock_out',
    queries: ['ft.timeEntries.listForJob'],
    patch: (p, rows) => mapRows(rows, idIs(p.id), (r) => ({ ...r, clock_out_at: p.clockOutAt, clockOutAt: p.clockOutAt })),
  },
  {
    op: 'job_note.create',
    queries: ['ft.notes.listForJob'],
    patch: (p, rows) => prepend(rows, { id: p.id, job_id: p.jobId, jobId: p.jobId, tech_id: p.techId, techId: p.techId, kind: p.kind, body: p.body, occurred_at: p.occurredAt, occurredAt: p.occurredAt }),
  },
  {
    op: 'job_photo.create',
    queries: ['ft.photos.listForJob'],
    patch: (p, rows) =>
      prepend(rows, {
        id: p.id, job_id: p.jobId, jobId: p.jobId, tech_id: p.techId, techId: p.techId, kind: p.kind,
        storage_path: p.storagePath, storagePath: p.storagePath, local_uri: p.localUri, localUri: p.localUri,
        occurred_at: p.occurredAt, occurredAt: p.occurredAt, lat: p.lat, lng: p.lng,
      }),
  },
  { op: 'job_photo.remove', queries: ['ft.photos.listForJob'], patch: (p, rows) => dropWhere(rows, idIs(p.id)) },
  {
    op: 'time_off_request.create',
    queries: ['ft.timeOff.listForTech', 'ft.timeOff.listForOrg'],
    patch: (p, rows) => prepend(rows, { id: p.id, tech_id: p.techId, techId: p.techId, start_date: p.startDate, startDate: p.startDate, end_date: p.endDate, endDate: p.endDate, reason: p.reason ?? null, status: 'pending' }),
  },
  {
    op: 'time_off_request.cancel',
    queries: ['ft.timeOff.listForTech', 'ft.timeOff.listForOrg'],
    patch: (p, rows) => mapRows(rows, idIs(p.requestId), (r) => ({ ...r, status: 'cancelled' })),
  },
  {
    op: 'checklist_instance.create',
    queries: ['ft.checklist.getInstanceForJob'],
    patch: (p, rows) =>
      rows === null || rows === undefined
        ? { id: p.id, job_id: p.jobId, jobId: p.jobId, template_id: p.templateId, templateId: p.templateId, kind: p.kind, status: 'in_progress', submitted_at: null }
        : rows,
  },
  {
    op: 'checklist_instance.submit',
    queries: ['ft.checklist.getInstanceForJob'],
    patch: (p, rows) => mapRows(rows, idIs(p.instanceId), (r) => ({ ...r, status: 'submitted', submitted_at: str(p.submittedAt), submittedAt: str(p.submittedAt) })),
  },
  {
    op: 'job_assignment.claim',
    queries: ['ft.premQueue.listOpen'],
    patch: (p, rows) => dropFromItems(rows, (r) => r.jobId === p.jobId || r.job_id === p.jobId || r.id === p.jobId),
  },
  {
    op: 'payroll_time.upsert',
    queries: ['pr.time'],
    patch: (p, rows) => {
      const row: Row = { id: p.id, user_id: p.userId, userId: p.userId, work_date: p.workDate, workDate: p.workDate, minutes: p.minutes, clock_in_at: p.clockInAt, clockInAt: p.clockInAt, clock_out_at: p.clockOutAt, clockOutAt: p.clockOutAt, source: p.source, notes: p.notes ?? null };
      if (Array.isArray(rows) && rows.some((r) => isObj(r) && r.id === p.id)) return mapRows(rows, idIs(p.id), (r) => ({ ...r, ...row }));
      return prepend(rows, { ...row, status: 'draft' });
    },
  },
  { op: 'payroll_time.delete', queries: ['pr.time'], patch: (p, rows) => dropWhere(rows, idIs(p.id)) },
  {
    op: 'payroll_timesheet.submit',
    queries: ['pr.time'],
    patch: (p, rows) => {
      const from = str(p.weekStart);
      const to = str(p.weekEnd);
      if (!from || !to) return rows;
      const inWeek = (r: Row) => {
        const d = str(r.work_date) ?? str(r.workDate);
        return d !== undefined && d >= from && d <= to && (r.status === 'draft' || r.status === 'rejected');
      };
      return mapRows(rows, inWeek, (r) => ({ ...r, status: 'submitted' }));
    },
  },
];

export function findPatchSpecs(op: string): OpPatchSpec[] {
  return OP_PATCH_SPECS.filter((s) => s.op === op);
}
