// Turns finished clock sessions (job_time_segments) into draft timesheet entries, so clocked
// time reaches payroll after the employee checks and submits it. Pure: no Supabase here.

export interface ClockSegmentRow {
  id: string;
  reason_code: string;
  started_at: string;
  ended_at: string | null;
  jobs?: { job_number?: string | number | null } | null;
}

export interface ClockDraft {
  id: string;
  workDate: string;
  minutes: number;
  clockInAt: string;
  clockOutAt: string;
  notes: string;
}

/** Local calendar day (device time zone), matching listSystemHours. */
export function localIsoDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * One draft per finished segment in range that has no entry yet. The entry id is the
 * segment id, so importing again never doubles up, and a dismissed one stays dismissed.
 */
export function clockDraftsFromSegments(
  segments: readonly ClockSegmentRow[],
  existingIds: ReadonlySet<string>,
  range: { from: string; to: string },
): ClockDraft[] {
  const out: ClockDraft[] = [];
  for (const s of segments) {
    if (!s.ended_at || existingIds.has(s.id)) continue;
    if (s.reason_code !== 'job_labor' && s.reason_code !== 'travel') continue;
    const ms = Date.parse(s.ended_at) - Date.parse(s.started_at);
    if (!Number.isFinite(ms) || ms <= 0) continue;
    const minutes = Math.round(ms / 60000);
    if (minutes < 1 || minutes > 1440) continue;
    const workDate = localIsoDate(s.started_at);
    if (workDate < range.from || workDate > range.to) continue;
    const job = s.jobs?.job_number != null ? `Job #${s.jobs.job_number}` : 'Job';
    out.push({
      id: s.id,
      workDate,
      minutes,
      clockInAt: s.started_at,
      clockOutAt: s.ended_at,
      notes: s.reason_code === 'travel' ? `${job} travel` : `${job} clock`,
    });
  }
  return out;
}
