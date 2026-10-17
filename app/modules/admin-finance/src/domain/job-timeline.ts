/**
 * Job timeline builder. Pure function; merges per-source rows into one
 * ascending, labelled list.
 *
 * Photos are intentionally excluded: they carry no timestamp available here.
 */

export type JobTimelineKind =
  | 'created'
  | 'status'
  | 'contact'
  | 'note'
  | 'time'
  | 'payment'
  | 'calendar'
  | 'failure';

export interface JobTimelineItem {
  at: string;
  kind: JobTimelineKind;
  label: string;
  actor: string | null;
}

export interface JobTimelineSources {
  jobCreatedAt: string | null;
  audit: { action: string; actorId: string | null; createdAt: string }[];
  contacts: { contactType: string; note: string | null; contactedBy: string | null; createdAt: string }[];
  notes: { kind: string; body: string; techId: string | null; occurredAt: string }[];
  segments: { reasonCode: string; startedAt: string; endedAt: string | null; techId: string; voidedAt: string | null }[];
  payments: { amount: number; status: string; method: string | null; createdAt: string }[];
  calendar: { kind: string; title: string | null; eventTime: string; createdBy: string | null }[];
  failures: { stage: string; reason: string; status: string; createdAt: string }[];
}

const NOTE_MAX = 120;

function truncate(text: string): string {
  return text.length > NOTE_MAX ? `${text.slice(0, NOTE_MAX - 1)}…` : text;
}

/** Build the job timeline, sorted ascending by time; ties keep source order. */
export function buildJobTimeline(src: JobTimelineSources): JobTimelineItem[] {
  const items: JobTimelineItem[] = [];

  if (src.jobCreatedAt) {
    items.push({ at: src.jobCreatedAt, kind: 'created', label: 'Job created (first contact)', actor: null });
  }
  for (const a of src.audit) {
    items.push({ at: a.createdAt, kind: 'status', label: a.action, actor: a.actorId });
  }
  for (const c of src.contacts) {
    items.push({
      at: c.createdAt,
      kind: 'contact',
      label: `Contact (${c.contactType})${c.note ? `: ${c.note}` : ''}`,
      actor: c.contactedBy,
    });
  }
  for (const n of src.notes) {
    items.push({ at: n.occurredAt, kind: 'note', label: truncate(`${n.kind}: ${n.body}`), actor: n.techId });
  }
  for (const s of src.segments) {
    if (s.voidedAt !== null) continue;
    items.push({ at: s.startedAt, kind: 'time', label: `Time: ${s.reasonCode}`, actor: s.techId });
  }
  for (const p of src.payments) {
    items.push({
      at: p.createdAt,
      kind: 'payment',
      label: `Payment $${p.amount.toFixed(2)} (${p.status}${p.method ? ', ' + p.method : ''})`,
      actor: null,
    });
  }
  for (const e of src.calendar) {
    items.push({ at: e.eventTime, kind: 'calendar', label: e.title || e.kind, actor: e.createdBy });
  }
  for (const f of src.failures) {
    items.push({
      at: f.createdAt,
      kind: 'failure',
      label: `Close-out ${f.stage} failed: ${f.reason} [${f.status}]`,
      actor: null,
    });
  }

  return items
    .map((item, index) => ({ item, index, t: Date.parse(item.at) }))
    .filter((x) => !Number.isNaN(x.t))
    .sort((a, b) => a.t - b.t || a.index - b.index)
    .map((x) => x.item);
}
