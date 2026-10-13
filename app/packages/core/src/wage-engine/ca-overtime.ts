import type {
  DayAllocation,
  IsoDate,
  MinuteBuckets,
  OvertimeConfig,
  WeekAllocation,
  WorkedDay,
} from './types.js';

/** California defaults: 8h daily OT, 12h daily DT, 40h weekly OT, 7th-day rule on. */
export const DEFAULT_OVERTIME_CONFIG: OvertimeConfig = {
  dailyOtAfterMin: 480,
  dailyDtAfterMin: 720,
  weeklyOtAfterMin: 2400,
  seventhDayRule: true,
};

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertMinutes(minutes: number): void {
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes) || minutes < 0) {
    throw new RangeError(`minutes must be a finite non-negative integer, got ${minutes}`);
  }
}

/** Calendar date -> whole days since epoch, via Date.UTC only (no local time). */
function toDayNumber(date: IsoDate): number {
  if (!DATE_RE.test(date)) throw new RangeError(`bad date '${date}', expected YYYY-MM-DD`);
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
    throw new RangeError(`bad date '${date}', not a real calendar day`);
  }
  return ms / DAY_MS;
}

function fromDayNumber(n: number): IsoDate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Split one day's minutes into regular / 1.5x / 2x buckets. */
export function allocateDay(minutes: number, config: OvertimeConfig): MinuteBuckets {
  assertMinutes(minutes);
  if (config.dailyOtAfterMin > config.dailyDtAfterMin) {
    throw new RangeError('dailyOtAfterMin must not exceed dailyDtAfterMin');
  }
  const dtMin = Math.max(0, minutes - config.dailyDtAfterMin);
  const otMin = Math.max(0, Math.min(minutes, config.dailyDtAfterMin) - config.dailyOtAfterMin);
  return { regularMin: minutes - otMin - dtMin, otMin, dtMin };
}

/**
 * Allocate one workweek of worked days. Pure: dates are compared as calendar days.
 * When weekStart is omitted the week runs from the first to the last input date.
 * The input span must be <= 7 days.
 */
export function allocateWorkweek(
  days: WorkedDay[],
  config: OvertimeConfig,
  weekStart?: IsoDate,
): WeekAllocation {
  const merged = new Map<number, number>();
  for (const day of days) {
    const n = toDayNumber(day.workDate);
    assertMinutes(day.minutes);
    merged.set(n, (merged.get(n) ?? 0) + day.minutes);
  }
  const keys = [...merged.keys()].sort((a, b) => a - b);

  let startN: number;
  let endN: number;
  if (weekStart !== undefined) {
    startN = toDayNumber(weekStart);
    endN = startN + 6;
    for (const k of keys) {
      if (k < startN || k > endN) {
        throw new RangeError(`date ${fromDayNumber(k)} falls outside week ${weekStart}`);
      }
    }
  } else if (keys.length > 0) {
    startN = keys[0]!;
    endN = keys[keys.length - 1]!;
  } else {
    throw new RangeError('no days and no weekStart');
  }
  if (keys.length > 0 && keys[keys.length - 1]! - keys[0]! > 6) {
    throw new RangeError('input dates span more than 7 days');
  }

  const rows: DayAllocation[] = keys.map((k) => ({
    workDate: fromDayNumber(k),
    ...allocateDay(merged.get(k)!, config),
    seventhDay: false,
  }));

  const worked = rows.filter((r) => merged.get(toDayNumber(r.workDate))! > 0);
  if (
    config.seventhDayRule &&
    worked.length === 7 &&
    toDayNumber(worked[6]!.workDate) - toDayNumber(worked[0]!.workDate) === 6
  ) {
    const last = worked[6]!;
    const total = merged.get(toDayNumber(last.workDate))!;
    last.seventhDay = true;
    last.regularMin = 0;
    last.otMin = Math.min(total, config.dailyOtAfterMin);
    last.dtMin = total - last.otMin;
  }

  const regularSum = rows.reduce((s, r) => (r.seventhDay ? s : s + r.regularMin), 0);
  let remaining = Math.max(0, regularSum - config.weeklyOtAfterMin);
  for (let i = rows.length - 1; i >= 0 && remaining > 0; i--) {
    const r = rows[i]!;
    if (r.seventhDay) continue;
    const move = Math.min(r.regularMin, remaining);
    r.regularMin -= move;
    r.otMin += move;
    remaining -= move;
  }

  const totals: MinuteBuckets = { regularMin: 0, otMin: 0, dtMin: 0 };
  for (const r of rows) {
    totals.regularMin += r.regularMin;
    totals.otMin += r.otMin;
    totals.dtMin += r.dtMin;
  }
  return { weekStart: fromDayNumber(startN), weekEnd: fromDayNumber(endN), days: rows, totals };
}
