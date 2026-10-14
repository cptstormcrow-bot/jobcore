import { allocateWorkweek, DEFAULT_OVERTIME_CONFIG } from './ca-overtime.js';
import { weekStartOf } from './periods.js';
import type {
  DayAllocation,
  IsoDate,
  OvertimeConfig,
  PayWeekConfig,
  RollupGranularity,
  RollupRow,
  WorkedDay,
} from './types.js';

/**
 * Allocate worked days across any number of workweeks into per-day buckets.
 * Duplicate dates are merged; zero-minute days are dropped. Result is ascending by workDate.
 *
 * CONTRACT: the caller must pass WHOLE workweeks. A week cut off mid-way gets wrong
 * weekly-OT and 7th-day treatment.
 */
export function allocateRange(
  days: WorkedDay[],
  overtime: OvertimeConfig,
  week: PayWeekConfig,
): DayAllocation[] {
  const merged = new Map<IsoDate, number>();
  for (const d of days) {
    if (!Number.isInteger(d.minutes) || d.minutes < 0) {
      throw new RangeError(`minutes must be a non-negative integer, got ${d.minutes}`);
    }
    merged.set(d.workDate, (merged.get(d.workDate) ?? 0) + d.minutes);
  }
  const byWeek = new Map<IsoDate, WorkedDay[]>();
  for (const [workDate, minutes] of merged) {
    if (minutes === 0) continue;
    const ws = weekStartOf(workDate, week);
    const list = byWeek.get(ws) ?? [];
    list.push({ workDate, minutes });
    byWeek.set(ws, list);
  }
  const out: DayAllocation[] = [];
  for (const [ws, list] of byWeek) {
    out.push(...allocateWorkweek(list, overtime, ws).days);
  }
  return out.sort((a, b) => (a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : 0));
}

/** Bucket key for a date: day 'YYYY-MM-DD', week = week-start date, month 'YYYY-MM', year 'YYYY'. */
export function rollupKey(
  workDate: IsoDate,
  granularity: RollupGranularity,
  week: PayWeekConfig,
): string {
  switch (granularity) {
    case 'day':
      return workDate;
    case 'week':
      return weekStartOf(workDate, week);
    case 'month':
      return workDate.slice(0, 7);
    case 'year':
      return workDate.slice(0, 4);
  }
}

/** Minimal structural shape of a payroll time entry (core cannot import payroll-ui). */
export interface WorkedEntryLike {
  workDate: IsoDate;
  minutes: number;
  status: string;
}

/** Drop rejected entries and sum minutes per workDate, in the shape `rollup` consumes. */
export function workedDaysFromEntries(entries: readonly WorkedEntryLike[]): WorkedDay[] {
  const byDate = new Map<IsoDate, number>();
  for (const e of entries) {
    if (e.status === 'rejected') continue;
    byDate.set(e.workDate, (byDate.get(e.workDate) ?? 0) + e.minutes);
  }
  return [...byDate].map(([workDate, minutes]) => ({ workDate, minutes }));
}

/** Worked minutes (regular + OT + DT) in the week, month and year containing `today`. */
export function currentPeriodMinutes(
  entries: readonly WorkedEntryLike[],
  today: IsoDate,
  payWeek: PayWeekConfig,
): { weekMin: number; monthMin: number; yearMin: number } {
  const days = workedDaysFromEntries(entries);
  const pick = (g: RollupGranularity): number => {
    const key = rollupKey(today, g, payWeek);
    const rows = rollup(days, g, DEFAULT_OVERTIME_CONFIG, payWeek);
    return rows.find((r) => r.key === key)?.totalMin ?? 0;
  };
  return { weekMin: pick('week'), monthMin: pick('month'), yearMin: pick('year') };
}

/**
 * Sum allocated minutes per bucket. Month and year sums come from day-level allocations,
 * so a week straddling a boundary splits exactly by day. Rows ascend by key.
 */
export function rollup(
  days: WorkedDay[],
  granularity: RollupGranularity,
  overtime: OvertimeConfig,
  week: PayWeekConfig,
): RollupRow[] {
  const rows = new Map<string, RollupRow>();
  for (const a of allocateRange(days, overtime, week)) {
    const key = rollupKey(a.workDate, granularity, week);
    let row = rows.get(key);
    if (!row) {
      row = { granularity, key, regularMin: 0, otMin: 0, dtMin: 0, totalMin: 0 };
      rows.set(key, row);
    }
    row.regularMin += a.regularMin;
    row.otMin += a.otMin;
    row.dtMin += a.dtMin;
    row.totalMin += a.regularMin + a.otMin + a.dtMin;
  }
  return [...rows.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
