/**
 * Payroll hours check (#0087): compares the hours each tech entered on their
 * timesheet with the hours the job clock recorded (job labor plus travel).
 * Report only. Nothing here posts or changes pay.
 */

/** One tech's timesheet minutes for the range (rejected entries already left out). */
export interface EnteredHours {
  userId: string;
  name: string;
  minutes: number;
}

/** One tech's job-clock minutes for the range. */
export interface SystemHours {
  userId: string;
  jobMin: number;
  travelMin: number;
}

export interface HoursCheckRow {
  userId: string;
  name: string;
  enteredMin: number;
  jobMin: number;
  travelMin: number;
  systemMin: number;
  /** enteredMin - systemMin. Positive means the timesheet has more than the clock. */
  diffMin: number;
}

/** One row per tech seen on either side, biggest difference first, then by name. */
export function compareHours(
  entered: EnteredHours[],
  system: SystemHours[],
  names: Record<string, string> = {},
): HoursCheckRow[] {
  const rows = new Map<string, HoursCheckRow>();
  const row = (userId: string): HoursCheckRow => {
    let r = rows.get(userId);
    if (!r) {
      r = { userId, name: names[userId] ?? '', enteredMin: 0, jobMin: 0, travelMin: 0, systemMin: 0, diffMin: 0 };
      rows.set(userId, r);
    }
    return r;
  };
  for (const e of entered) {
    const r = row(e.userId);
    r.enteredMin += Math.round(e.minutes);
    if (!r.name && e.name) r.name = e.name;
  }
  for (const s of system) {
    const r = row(s.userId);
    r.jobMin += Math.round(s.jobMin);
    r.travelMin += Math.round(s.travelMin);
  }
  const out = [...rows.values()];
  for (const r of out) {
    r.systemMin = r.jobMin + r.travelMin;
    r.diffMin = r.enteredMin - r.systemMin;
  }
  return out.sort((a, b) => Math.abs(b.diffMin) - Math.abs(a.diffMin) || a.name.localeCompare(b.name));
}
