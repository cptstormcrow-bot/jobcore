import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDayToValue,
  applyTimeToValue,
  buildMonthGrid,
  dateKeyOfDate,
  dateKeyOfIso,
  deriveEndIso,
  formatSlotHeading,
  groupItemsByLocalDay,
  isoToLocalParts,
  localPartsToIso,
  monthTitle,
  shiftMonth,
  slotDurationMinutes,
  slotsEqual,
  to12h,
  to24h,
  type SchedulePickerItem,
} from '../schedule-picker';

const iso = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m, d, h, min, s).toISOString();

test('month grid', () => {
  const g = buildMonthGrid(2026, 9);
  assert.equal(g.length, 42);
  assert.deepEqual(g[0], { year: 2026, month: 8, day: 27, dateKey: '2026-09-27', inMonth: false });
  assert.equal(g[41]?.dateKey, '2026-11-07');
  assert.equal(g[4]?.dateKey, '2026-10-01');
  assert.equal(g[4]?.inMonth, true);
  assert.equal(g.filter((c) => c.inMonth).length, 31);
});

test('shiftMonth and monthTitle', () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth(2026, 9, 0), { year: 2026, month: 9 });
  assert.deepEqual(shiftMonth(2026, 9, -22), { year: 2024, month: 11 });
  assert.equal(monthTitle(2026, 9), 'October 2026');
});

test('iso <-> local parts', () => {
  assert.equal(isoToLocalParts(null), null);
  assert.equal(isoToLocalParts('nope'), null);
  const d = new Date(2026, 9, 22, 12, 39);
  assert.deepEqual(isoToLocalParts(d.toISOString()), { year: 2026, month: 9, day: 22, hour24: 12, minute: 39 });
  const p = { year: 2026, month: 0, day: 5, hour24: 23, minute: 5 };
  assert.deepEqual(isoToLocalParts(localPartsToIso(p)), p);
  assert.equal(localPartsToIso(p), new Date(2026, 0, 5, 23, 5).toISOString());
});

test('12h / 24h', () => {
  assert.deepEqual(to12h(0), { hour12: 12, meridiem: 'AM' });
  assert.deepEqual(to12h(12), { hour12: 12, meridiem: 'PM' });
  assert.deepEqual(to12h(1), { hour12: 1, meridiem: 'AM' });
  assert.deepEqual(to12h(23), { hour12: 11, meridiem: 'PM' });
  assert.equal(to24h(12, 'AM'), 0);
  assert.equal(to24h(12, 'PM'), 12);
  assert.equal(to24h(1, 'AM'), 1);
  assert.equal(to24h(11, 'PM'), 23);
});

test('date keys', () => {
  const d = new Date(2026, 9, 2, 23, 59);
  assert.equal(dateKeyOfDate(d), '2026-10-02');
  assert.equal(dateKeyOfIso(d.toISOString()), '2026-10-02');
});

test('formatSlotHeading', () => {
  const s = iso(2026, 9, 22, 12, 39);
  assert.equal(formatSlotHeading(s, iso(2026, 9, 22, 13, 39)), 'Thursday, October 22, 2026 at 12:39 PM to 1:39 PM');
  assert.equal(formatSlotHeading(s, iso(2026, 9, 23, 9, 5)), 'Thursday, October 22, 2026 at 12:39 PM to Fri, Oct 23 9:05 AM');
  assert.equal(formatSlotHeading(s, null), 'Thursday, October 22, 2026 at 12:39 PM');
  assert.equal(formatSlotHeading(null, s), 'Not scheduled');
  assert.equal(formatSlotHeading('garbage', null), 'Not scheduled');
  assert.equal(formatSlotHeading(iso(2026, 9, 22, 0, 5), null), 'Thursday, October 22, 2026 at 12:05 AM');
});

test('slotsEqual', () => {
  const a = iso(2026, 9, 22, 12, 39, 5);
  const b = iso(2026, 9, 22, 12, 39, 50);
  const e = iso(2026, 9, 22, 13, 39);
  assert.equal(slotsEqual({ startIso: a, endIso: e }, { startIso: b, endIso: e }), true);
  assert.equal(slotsEqual({ startIso: a, endIso: e }, { startIso: iso(2026, 9, 22, 12, 40), endIso: e }), false);
  assert.equal(slotsEqual({ startIso: null, endIso: null }, { startIso: null, endIso: null }), true);
  assert.equal(slotsEqual({ startIso: a, endIso: null }, { startIso: a, endIso: e }), false);
  assert.equal(slotsEqual({ startIso: null, endIso: null }, { startIso: a, endIso: null }), false);
});

test('duration and deriveEnd', () => {
  const s = iso(2026, 9, 22, 10, 0);
  assert.equal(slotDurationMinutes(s, iso(2026, 9, 22, 11, 30), 15), 90);
  assert.equal(slotDurationMinutes(s, iso(2026, 9, 22, 9, 0), 45), 45);
  assert.equal(slotDurationMinutes(s, null, 30), 30);
  assert.equal(slotDurationMinutes(s, null, 0), 60);
  assert.equal(slotDurationMinutes(null, null, -5), 60);
  assert.equal(slotDurationMinutes(s, s, 20), 20);
  assert.equal(deriveEndIso(iso(2026, 9, 22, 23, 30), 60), iso(2026, 9, 23, 0, 30));
  assert.equal(dateKeyOfIso(deriveEndIso(iso(2026, 9, 22, 23, 30), 60)), '2026-10-23');
});

test('applyDayToValue', () => {
  const v = iso(2026, 9, 22, 14, 25);
  assert.equal(applyDayToValue(v, { year: 2026, month: 10, day: 3 }), iso(2026, 10, 3, 14, 25));
  assert.equal(applyDayToValue(null, { year: 2026, month: 10, day: 3 }), iso(2026, 10, 3, 9, 0));
  assert.equal(applyDayToValue('bad', { year: 2026, month: 10, day: 3 }, 8), iso(2026, 10, 3, 8, 0));
});

test('applyTimeToValue', () => {
  const now = new Date(2026, 9, 22, 18, 0);
  const v = iso(2026, 9, 22, 14, 25);
  assert.equal(applyTimeToValue(v, { hour12: 3 }, now), iso(2026, 9, 22, 15, 25));
  assert.equal(applyTimeToValue(v, { meridiem: 'AM' }, now), iso(2026, 9, 22, 2, 25));
  assert.equal(applyTimeToValue(v, { minute: 0 }, now), iso(2026, 9, 22, 14, 0));
  assert.equal(applyTimeToValue(v, { hour12: 12, meridiem: 'AM' }, now), iso(2026, 9, 22, 0, 25));
  assert.equal(applyTimeToValue(null, {}, now), iso(2026, 9, 22, 9, 0));
  assert.equal(applyTimeToValue(null, { hour12: 5, meridiem: 'PM', minute: 30 }, now), iso(2026, 9, 22, 17, 30));
  assert.equal(applyTimeToValue(null, { minute: 15 }, now), iso(2026, 9, 22, 9, 15));
});

test('groupItemsByLocalDay', () => {
  const mk = (id: string, title: string, start: string, end: string | null, kind: 'job' | 'blackout' = 'job'): SchedulePickerItem => ({
    id, kind, title, startIso: start, endIso: end,
  });
  const blackout = mk('b', 'Out', iso(2026, 9, 22, 8, 0), iso(2026, 9, 24, 17, 0), 'blackout');
  const endsMidnight = mk('j1', 'Midnight', iso(2026, 9, 22, 20, 0), iso(2026, 9, 23, 0, 0));
  const noEnd = mk('j2', 'NoEnd', iso(2026, 9, 25, 9, 0), null);
  const badEnd = mk('j3', 'BadEnd', iso(2026, 9, 26, 9, 0), iso(2026, 9, 26, 8, 0));
  const later = mk('j4', 'Alpha', iso(2026, 9, 22, 13, 0), iso(2026, 9, 22, 14, 0));
  const tie = mk('j5', 'Aardvark', iso(2026, 9, 22, 13, 0), iso(2026, 9, 22, 14, 0));
  const m = groupItemsByLocalDay([blackout, endsMidnight, noEnd, badEnd, later, tie]);
  assert.deepEqual([...m.keys()].filter((k) => m.get(k)!.some((i) => i.id === 'b')).sort(), ['2026-10-22', '2026-10-23', '2026-10-24']);
  assert.equal(m.get('2026-10-23')!.some((i) => i.id === 'j1'), false);
  assert.equal(m.get('2026-10-22')!.some((i) => i.id === 'j1'), true);
  assert.deepEqual(m.get('2026-10-25')!.map((i) => i.id), ['j2']);
  assert.deepEqual(m.get('2026-10-26')!.map((i) => i.id), ['j3']);
  assert.deepEqual(m.get('2026-10-22')!.map((i) => i.id), ['b', 'j5', 'j4', 'j1']);
  const long = mk('l', 'Long', iso(2026, 0, 1, 9, 0), iso(2028, 0, 1, 9, 0));
  const lm = groupItemsByLocalDay([long]);
  assert.equal(lm.size, 366);
});
