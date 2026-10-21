/** Minutes between selectable times on the 30-minute grid. */
export const TIME_STEP_MIN = 30;
/** Earliest selectable time. */
export const FIRST_TIME = '00:00';
/** Latest selectable time. */
export const LAST_TIME = '23:30';

/** A start/end pair of 24-hour 'HH:MM' strings. */
export type TimeRange = { start: string; end: string };

const MAX_MIN = 23 * 60 + 30;

/** 'HH:MM' -> minutes since midnight; malformed input returns 0, never NaN. */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return 0;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(total) ? total : 0;
}

/** Minutes -> zero-padded 'HH:MM', clamped to 0..1410 (never '24:00'). */
export function fromMinutes(min: number): string {
  const n = Number.isFinite(min) ? min : 0;
  const c = Math.min(MAX_MIN, Math.max(0, Math.round(n)));
  const h = Math.floor(c / 60);
  const mm = c % 60;
  return `${h < 10 ? '0' : ''}${h}:${mm < 10 ? '0' : ''}${mm}`;
}

/** "08:00" -> "8:00 AM", "00:00" -> "12:00 AM", "13:30" -> "1:30 PM". */
export function format12h(hhmm: string): string {
  const total = toMinutes(hhmm);
  const h24 = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm < 10 ? '0' : ''}${mm} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** Nearest 30-minute multiple (half rounds up), clamped to 0..1410. */
function snapMinutes(min: number): number {
  const n = Number.isFinite(min) ? min : 0;
  const snapped = Math.floor(n / TIME_STEP_MIN + 0.5) * TIME_STEP_MIN;
  return Math.min(MAX_MIN, Math.max(0, snapped));
}

/** Snap to the nearest slot, move one step in `dir`, clamp to 00:00..23:30. */
export function stepTime(hhmm: string, dir: 1 | -1): string {
  return fromMinutes(snapMinutes(toMinutes(hhmm)) + dir * TIME_STEP_MIN);
}

/** Default end: snapped start + max(duration, 30), rounded up to the next slot, clamped to 23:30. */
export function defaultEnd(start: string, durationMin: number): string {
  const dur = Math.max(Number.isFinite(durationMin) ? durationMin : 0, TIME_STEP_MIN);
  const raw = snapMinutes(toMinutes(start)) + dur;
  return fromMinutes(Math.ceil(raw / TIME_STEP_MIN) * TIME_STEP_MIN);
}

/** Snap both ends; start in [00:00, 23:00], end in [start+30, 23:30]. Always valid. */
export function clampRange(start: string, end: string): TimeRange {
  const s = Math.min(MAX_MIN - TIME_STEP_MIN, snapMinutes(toMinutes(start)));
  const e = Math.min(MAX_MIN, Math.max(s + TIME_STEP_MIN, snapMinutes(toMinutes(end))));
  return { start: fromMinutes(s), end: fromMinutes(e) };
}

/** True only when end is strictly after start. */
export function isValidRange(start: string, end: string): boolean {
  return toMinutes(end) > toMinutes(start);
}

/** Move start one step, keeping the duration (end moves with it), then clamp. */
export function stepStart(range: TimeRange, dir: 1 | -1): TimeRange {
  const delta = dir * TIME_STEP_MIN;
  return clampRange(
    fromMinutes(snapMinutes(toMinutes(range.start)) + delta),
    fromMinutes(snapMinutes(toMinutes(range.end)) + delta),
  );
}

/** Step end one step, then clamp so end never goes at or before start. */
export function stepEnd(range: TimeRange, dir: 1 | -1): TimeRange {
  return clampRange(range.start, stepTime(range.end, dir));
}
