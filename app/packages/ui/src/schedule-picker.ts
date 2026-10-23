// Pure helpers for the schedule picker / calendar (no react, no runtime imports).

export type SchedulePickerItem = {
  id: string;
  kind: 'job' | 'blackout';
  startIso: string;
  endIso: string | null;
  title: string;
  subtitle?: string;
  isCurrent?: boolean;
};

export type LocalParts = { year: number; month: number; day: number; hour24: number; minute: number };
export type MonthCell = { year: number; month: number; day: number; dateKey: string; inMonth: boolean };
export type Slot = { startIso: string | null; endIso: string | null };
export type Meridiem = 'AM' | 'PM';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad2 = (n: number): string => (n < 10 ? '0' + n : String(n));

/** Local 'YYYY-MM-DD' key for a year, 0-based month and day. */
function keyOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** Parse an ISO string to a Date, or null when missing or invalid. */
function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 42-cell (6x7) Sunday-first month grid including out-of-month days. */
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const lead = first.getDay();
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - lead + i);
    cells.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      dateKey: keyOf(d.getFullYear(), d.getMonth(), d.getDate()),
      inMonth: d.getMonth() === first.getMonth() && d.getFullYear() === first.getFullYear(),
    });
  }
  return cells;
}

/** Move a year/month by delta months, wrapping the year both ways. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** English title such as 'October 2026'. */
export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** Split an ISO string into LOCAL calendar/time parts; null when null or invalid. */
export function isoToLocalParts(iso: string | null): LocalParts | null {
  const d = parseIso(iso);
  if (!d) return null;
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), hour24: d.getHours(), minute: d.getMinutes() };
}

/** Build an ISO string from LOCAL calendar/time parts. */
export function localPartsToIso(p: LocalParts): string {
  return new Date(p.year, p.month, p.day, p.hour24, p.minute, 0, 0).toISOString();
}

/** 24-hour value to 12-hour clock (0 -> 12 AM, 12 -> 12 PM). */
export function to12h(hour24: number): { hour12: number; meridiem: Meridiem } {
  const h = ((Math.floor(hour24) % 24) + 24) % 24;
  return { hour12: h % 12 === 0 ? 12 : h % 12, meridiem: h >= 12 ? 'PM' : 'AM' };
}

/** 12-hour clock value back to 24-hour (12 AM -> 0, 12 PM -> 12). */
export function to24h(hour12: number, meridiem: Meridiem): number {
  return (hour12 % 12) + (meridiem === 'PM' ? 12 : 0);
}

/** Local 'YYYY-MM-DD' of an ISO string; '' when invalid. */
export function dateKeyOfIso(iso: string): string {
  const d = parseIso(iso);
  return d ? dateKeyOfDate(d) : '';
}

/** Local 'YYYY-MM-DD' of a Date. */
export function dateKeyOfDate(date: Date): string {
  return keyOf(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Clock text like '12:39 PM' (no leading zero on the hour). */
function clock(d: Date): string {
  const t = to12h(d.getHours());
  return `${t.hour12}:${pad2(d.getMinutes())} ${t.meridiem}`;
}

/** Human heading for a slot, or 'Not scheduled' when the start is missing/invalid. */
export function formatSlotHeading(startIso: string | null, endIso: string | null): string {
  const s = parseIso(startIso);
  if (!s) return 'Not scheduled';
  const head = `${WEEKDAYS[s.getDay()]}, ${MONTHS[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} at ${clock(s)}`;
  const e = parseIso(endIso);
  if (!e) return head;
  if (dateKeyOfDate(s) === dateKeyOfDate(e)) return `${head} to ${clock(e)}`;
  return `${head} to ${(WEEKDAYS[e.getDay()] ?? '').slice(0, 3)}, ${(MONTHS[e.getMonth()] ?? '').slice(0, 3)} ${e.getDate()} ${clock(e)}`;
}

/** Whole-minute bucket of an ISO string, or null. */
function minuteOf(iso: string | null): number | null {
  const d = parseIso(iso);
  return d ? Math.floor(d.getTime() / 60000) : null;
}

/** True when starts and ends match at whole-minute resolution; null matches only null. */
export function slotsEqual(a: Slot, b: Slot): boolean {
  return minuteOf(a.startIso) === minuteOf(b.startIso) && minuteOf(a.endIso) === minuteOf(b.endIso);
}

/** Minutes from start to end when valid and end > start; else positive fallback; else 60. */
export function slotDurationMinutes(startIso: string | null, endIso: string | null, fallbackMinutes?: number | null): number {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  if (s && e && e.getTime() > s.getTime()) return Math.round((e.getTime() - s.getTime()) / 60000);
  if (typeof fallbackMinutes === 'number' && Number.isFinite(fallbackMinutes) && fallbackMinutes > 0) return fallbackMinutes;
  return 60;
}

/** ISO of start plus a duration in minutes; '' when start is invalid. */
export function deriveEndIso(startIso: string, durationMinutes: number): string {
  const s = parseIso(startIso);
  if (!s) return '';
  return new Date(s.getTime() + durationMinutes * 60000).toISOString();
}

/** Set the LOCAL calendar day, keeping hour/minute (default defaultHour24:00 when no value). */
export function applyDayToValue(
  valueIso: string | null,
  day: { year: number; month: number; day: number },
  defaultHour24 = 9,
): string {
  const p = isoToLocalParts(valueIso);
  return localPartsToIso({
    year: day.year,
    month: day.month,
    day: day.day,
    hour24: p ? p.hour24 : defaultHour24,
    minute: p ? p.minute : 0,
  });
}

/** Change only the time-of-day parts in the patch; null value uses now's local date and 9:00 AM base. */
export function applyTimeToValue(
  valueIso: string | null,
  patch: { hour12?: number; meridiem?: Meridiem; minute?: number },
  now: Date,
): string {
  const p = isoToLocalParts(valueIso);
  const base: LocalParts = p ?? {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    hour24: 9,
    minute: 0,
  };
  const cur = to12h(base.hour24);
  const hour24 = to24h(patch.hour12 ?? cur.hour12, patch.meridiem ?? cur.meridiem);
  return localPartsToIso({ ...base, hour24, minute: patch.minute ?? base.minute });
}

/** Group items under every local day they cover (max 366 days each), sorted by start then title. */
export function groupItemsByLocalDay(items: SchedulePickerItem[]): Map<string, SchedulePickerItem[]> {
  const map = new Map<string, SchedulePickerItem[]>();
  const add = (key: string, item: SchedulePickerItem) => {
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  };
  for (const item of items) {
    const s = parseIso(item.startIso);
    if (!s) continue;
    const e = parseIso(item.endIso);
    let last = s;
    if (e && e.getTime() > s.getTime()) last = new Date(e.getTime() - 1);
    const lastKey = dateKeyOfDate(last);
    for (let i = 0; i < 366; i++) {
      const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i);
      const key = dateKeyOfDate(d);
      add(key, item);
      if (key === lastKey) break;
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const diff = new Date(a.startIso).getTime() - new Date(b.startIso).getTime();
      if (diff !== 0) return diff;
      return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
    });
  }
  return map;
}
