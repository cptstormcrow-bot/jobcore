import type { IsoDate, PayWeekConfig } from './types.js';

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** UTC epoch ms -> 'YYYY-MM-DD' (UTC fields, zero-padded). */
export function formatIsoDate(ms: number): IsoDate {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

/** 'YYYY-MM-DD' -> UTC-midnight epoch ms. Rejects malformed and non-existent dates. */
export function parseIsoDate(date: IsoDate): number {
  if (!DATE_RE.test(date)) throw new RangeError(`Invalid ISO date: ${date}`);
  const ms = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  if (Number.isNaN(ms) || formatIsoDate(ms) !== date) throw new RangeError(`Invalid ISO date: ${date}`);
  return ms;
}

/** Add (or, if negative, subtract) whole calendar days. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return formatIsoDate(parseIsoDate(date) + days * DAY_MS);
}

/** Day of week, 0 = Sunday .. 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  return new Date(parseIsoDate(date)).getUTCDay();
}

function assertWeekStartDow(cfg: PayWeekConfig): void {
  const d = cfg.weekStartDow;
  if (!Number.isInteger(d) || d < 0 || d > 6) {
    throw new RangeError(`weekStartDow must be an integer 0..6, got ${d}`);
  }
}

/** Latest date <= `date` whose day of week equals cfg.weekStartDow. */
export function weekStartOf(date: IsoDate, cfg: PayWeekConfig): IsoDate {
  assertWeekStartDow(cfg);
  const back = (dayOfWeek(date) - cfg.weekStartDow + 7) % 7;
  return addDays(date, -back);
}

/** Last day of the pay week containing `date` (week start + 6 days). */
export function weekEndOf(date: IsoDate, cfg: PayWeekConfig): IsoDate {
  return addDays(weekStartOf(date, cfg), 6);
}

/** Seven consecutive dates starting at `weekStart`. */
export function weekDates(weekStart: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let i = 0; i < 7; i++) out.push(addDays(weekStart, i));
  return out;
}

/** Whole weeks from the anchor's week to `date`'s week (negative when earlier). Display use only. */
export function weekIndexFromAnchor(date: IsoDate, cfg: PayWeekConfig): number {
  const a = parseIsoDate(weekStartOf(cfg.anchorDate, cfg));
  const b = parseIsoDate(weekStartOf(date, cfg));
  return Math.round((b - a) / (7 * DAY_MS));
}
