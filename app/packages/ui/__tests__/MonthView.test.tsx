import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { Job } from '@jobcore/core';
import { MonthView } from '../src/MonthView';
import type { TimeOffEvent } from '../src/WeekView';
import { colors } from '../src/tokens';

// Anchor: Oct 15 2026. Oct 1 is a Thursday, Oct 31 is a Saturday, so the
// Sunday-start grid runs Sun Sep 27 .. Sat Oct 31 = 35 days = 5 rows.
function colorOf(el: { props: { style?: unknown } }) {
  return (StyleSheet.flatten(el.props.style as never) as { color?: string }).color;
}

const anchor =new Date(2026, 9, 15);

function job(id: string, start: Date, address: string | null = id): Job {
  return { id, status: 'scheduled', scheduledStart: start.toISOString(), address } as unknown as Job;
}

function timeOff(id: string, extra: Record<string, unknown> = {}): TimeOffEvent {
  return { id, title: 'Vacation', description: null, eventTime: new Date(2026, 9, 10, 9).toISOString(), ...extra } as TimeOffEvent;
}

function sameParts(d: Date, y: number, m: number, day: number) {
  return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day;
}

describe('MonthView', () => {
  it('renders weekday header Sun..Sat', () => {
    const { getByText } = render(<MonthView jobs={[]} anchorDay={anchor} />);
    for (const label of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('renders a Sunday-start grid padded with adjacent-month days (35 cells)', () => {
    const onSelectDay = jest.fn();
    const { getAllByText, getByText } = render(<MonthView jobs={[]} anchorDay={anchor} onSelectDay={onSelectDay} />);
    // 27..30 appear twice (Sept padding + Oct), 1..26 and 31 once.
    expect(getAllByText('27')).toHaveLength(2);
    expect(getAllByText('30')).toHaveLength(2);
    expect(getAllByText('31')).toHaveLength(1);
    expect(getAllByText('1')).toHaveLength(1);
    // First grid cell is the Sept 27 padding day.
    fireEvent.press(getAllByText('27')[0]!);
    const first = onSelectDay.mock.calls[0]![0] as Date;
    expect(sameParts(first, 2026, 8, 27)).toBe(true);
    expect(first.getDay()).toBe(0);
    // Last grid cell is Oct 31 (Saturday).
    fireEvent.press(getByText('31'));
    const last = onSelectDay.mock.calls[1]![0] as Date;
    expect(sameParts(last, 2026, 9, 31)).toBe(true);
    expect(last.getDay()).toBe(6);
  });

  it('calls onSelectDay with the pressed day', () => {
    const onSelectDay = jest.fn();
    const { getByText } = render(<MonthView jobs={[]} anchorDay={anchor} onSelectDay={onSelectDay} />);
    fireEvent.press(getByText('20'));
    expect(onSelectDay).toHaveBeenCalledTimes(1);
    expect(sameParts(onSelectDay.mock.calls[0]![0] as Date, 2026, 9, 20)).toBe(true);
  });

  it('dots variant shows +N overflow when a day has more than 3 jobs', () => {
    const jobs = [1, 2, 3, 4].map((i) => job('j' + i, new Date(2026, 9, 20, 8 + i)));
    const { getByText, queryByText } = render(<MonthView jobs={jobs} anchorDay={anchor} />);
    expect(getByText('+1')).toBeTruthy();
    // Dots variant does not render job addresses.
    expect(queryByText('• j1')).toBeNull();
  });

  it('dots variant does not show +N for 3 or fewer jobs', () => {
    const jobs = [1, 2, 3].map((i) => job('j' + i, new Date(2026, 9, 20, 8 + i)));
    const { queryByText } = render(<MonthView jobs={jobs} anchorDay={anchor} />);
    expect(queryByText(/^\+\d+$/)).toBeNull();
  });

  it('dots variant highlights days covered by a time-off range', () => {
    const ev = timeOff('t1', { startDate: new Date(2026, 9, 10).toISOString(), endDate: new Date(2026, 9, 12).toISOString() });
    const { getByText } = render(<MonthView jobs={[]} anchorDay={anchor} timeOffEvents={[ev]} />);
    for (const d of ['10', '11', '12']) {
      expect(colorOf(getByText(d))).toBe(colors.danger);
    }
    expect(colorOf(getByText('13'))).not.toBe(colors.danger);
    expect(colorOf(getByText('9'))).not.toBe(colors.danger);
  });

  it('time off falls back to eventTime for a single day', () => {
    const ev = timeOff('t2'); // Oct 10 only
    const { getByText } = render(<MonthView jobs={[]} anchorDay={anchor} timeOffEvents={[ev]} />);
    expect(colorOf(getByText('10'))).toBe(colors.danger);
    expect(colorOf(getByText('11'))).not.toBe(colors.danger);
  });

  it('list variant shows jobs and calls onSelectJob', () => {
    const j = job('a', new Date(2026, 9, 22, 9), '12 Main St');
    const onSelectJob = jest.fn();
    const { getByText } = render(
      <MonthView jobs={[j]} anchorDay={anchor} variant="list" onSelectJob={onSelectJob} />
    );
    fireEvent.press(getByText('• 12 Main St'));
    expect(onSelectJob).toHaveBeenCalledWith(j);
  });

  it('list variant falls back to "No address" for jobs without an address', () => {
    const j = job('b', new Date(2026, 9, 22, 9), null);
    const { getByText } = render(<MonthView jobs={[j]} anchorDay={anchor} variant="list" />);
    expect(getByText('• No address')).toBeTruthy();
  });

  it('list variant shows time-off on each covered day and calls onSelectTimeOff', () => {
    const ev = timeOff('t3', { startDate: new Date(2026, 9, 10).toISOString(), endDate: new Date(2026, 9, 12).toISOString() });
    const onSelectTimeOff = jest.fn();
    const { getAllByText } = render(
      <MonthView jobs={[]} anchorDay={anchor} variant="list" timeOffEvents={[ev]} onSelectTimeOff={onSelectTimeOff} />
    );
    const items = getAllByText('• Vacation');
    expect(items).toHaveLength(3);
    fireEvent.press(items[0]!);
    expect(onSelectTimeOff).toHaveBeenCalledWith(ev);
  });

  it('list variant caps visible items at maxVisibleItems and shows "+N more"', () => {
    const jobs = [job('x1', new Date(2026, 9, 20, 8), 'First'), job('x2', new Date(2026, 9, 20, 9), 'Second'), job('x3', new Date(2026, 9, 20, 10), 'Third')];
    const { getByText, queryByText } = render(
      <MonthView jobs={jobs} anchorDay={anchor} variant="list" maxVisibleItems={1} />
    );
    expect(getByText('• First')).toBeTruthy();
    expect(queryByText('• Second')).toBeNull();
    expect(getByText('+2 more')).toBeTruthy();
  });

  it('list variant sorts a day\'s jobs by start time', () => {
    const jobs = [job('late', new Date(2026, 9, 20, 15), 'Late'), job('early', new Date(2026, 9, 20, 8), 'Early')];
    const { getByText, queryByText } = render(
      <MonthView jobs={jobs} anchorDay={anchor} variant="list" maxVisibleItems={1} />
    );
    expect(getByText('• Early')).toBeTruthy();
    expect(queryByText('• Late')).toBeNull();
  });
});
