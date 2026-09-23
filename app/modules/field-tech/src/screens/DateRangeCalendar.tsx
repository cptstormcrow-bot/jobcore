/**
 * DateRangeCalendar — date-range picker for `TimeOff.tsx` (Workstream F, 4a),
 * now sharing the same `CalendarHeader` / `WeekView` / `MonthView` primitives
 * as the Jobs calendar (`@jobcore/ui`) so the two calendars look identical.
 *
 * Controlled component: the parent (`TimeOff.tsx`) owns `startDate`/
 * `endDate` as ISO `YYYY-MM-DD` strings and passes `onChangeStartDate`/
 * `onChangeEndDate`. Tap behavior: the first tap (or a tap before the
 * current start) sets the start date and clears the end date; the next
 * tap sets the end date (swapping if it lands before the new start).
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  format,
  isSameDay,
  isBefore,
  isAfter,
  isWithinInterval,
} from 'date-fns';
import { CalendarHeader, WeekView, MonthView, colors, type CalendarMode, type TimeOffEvent, Text } from '@jobcore/ui';

export interface DateRangeCalendarProps {
  /** ISO `YYYY-MM-DD`, or empty string when unset. */
  startDate: string;
  /** ISO `YYYY-MM-DD`, or empty string when unset. */
  endDate: string;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
  disabled?: boolean;
  markedRanges?: { id: string; startDate: string; endDate: string }[];
  onSelectMarkedDay?: (id: string) => void;
  /** Fires after any non-marked day tap once start/end have been updated. */
  onDayTapped?: (day: Date) => void;
}

function parseIsoDate(value: string): Date | null {
  if (value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

export function DateRangeCalendar({
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate,
  disabled = false,
  markedRanges = [],
  onSelectMarkedDay,
  onDayTapped,
}: DateRangeCalendarProps): React.ReactElement {
  const parsedStart = parseIsoDate(startDate);
  const parsedEnd = parseIsoDate(endDate);

  const [mode, setMode] = React.useState<CalendarMode>('month');
  const [anchorDay, setAnchorDay] = React.useState<Date>(parsedStart ?? new Date());

  function findMarkedRangeId(day: Date): string | null {
    const dayIso = toIsoDate(day);
    const m = markedRanges.find((r) => dayIso >= r.startDate && dayIso <= r.endDate);
    return m ? m.id : null;
  }

  function handleSelectDay(day: Date): void {
    if (disabled) {
      return;
    }
    setAnchorDay(day);
    const mId = findMarkedRangeId(day);
    if (onSelectMarkedDay && mId !== null) {
      onSelectMarkedDay(mId);
      return;
    }
    if (
      parsedStart === null ||
      (parsedEnd !== null && isSameDay(parsedStart, parsedEnd) && isAfter(day, parsedStart))
    ) {
      if (parsedStart === null) {
        onChangeStartDate(toIsoDate(day));
      }
      onChangeEndDate(toIsoDate(day));
      onDayTapped?.(day);
      return;
    }
    if (isBefore(day, parsedStart)) {
      onChangeStartDate(toIsoDate(day));
      onChangeEndDate(toIsoDate(parsedStart));
      onDayTapped?.(day);
      return;
    }
    onChangeStartDate(toIsoDate(day));
    onChangeEndDate(toIsoDate(day));
    onDayTapped?.(day);
  }

  const timeOffEvents: TimeOffEvent[] = React.useMemo(() => {
    const events: TimeOffEvent[] = markedRanges.map((r) => ({
      id: r.id,
      title: null,
      description: null,
      eventTime: `${r.startDate}T00:00:00`,
      // Consumed by MonthView's range check; WeekView only reads eventTime.
      ...( { startDate: r.startDate, endDate: r.endDate } as any ),
    }));
    const pendingKey = parsedStart !== null && parsedEnd !== null ? `${toIsoDate(parsedStart)}|${toIsoDate(parsedEnd)}` : null;
    const alreadyMarked = pendingKey !== null && markedRanges.some((r) => `${r.startDate}|${r.endDate}` === pendingKey);
    if (!alreadyMarked && parsedStart !== null && parsedEnd !== null && isWithinInterval(parsedEnd, { start: parsedStart, end: parsedEnd })) {
      events.push({
        id: '__pending-selection__',
        title: 'Selected',
        description: null,
        eventTime: `${toIsoDate(parsedStart)}T00:00:00`,
        ...( { startDate: toIsoDate(parsedStart), endDate: toIsoDate(parsedEnd) } as any ),
      });
    }
    return events;
  }, [markedRanges, parsedStart, parsedEnd]);

  const label =
    mode === 'month'
      ? format(anchorDay, 'MMMM yyyy')
      : `${format(startOfWeek(anchorDay, { weekStartsOn: 0 }), 'MMM d')} – ${format(
          endOfWeek(anchorDay, { weekStartsOn: 0 }),
          'MMM d, yyyy'
        )}`;

  function handlePrev(): void {
    if (disabled) return;
    setAnchorDay((prev) => (mode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1)));
  }

  function handleNext(): void {
    if (disabled) return;
    setAnchorDay((prev) => (mode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1)));
  }

  function handleToday(): void {
    if (disabled) return;
    setAnchorDay(mode === 'month' ? startOfMonth(new Date()) : new Date());
  }

  return (
    <View style={styles.container}>
      <CalendarHeader
        mode={mode}
        onModeChange={setMode}
        label={label}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />

      {mode === 'week' ? (
        <WeekView jobs={[]} anchorDay={anchorDay} timeOffEvents={timeOffEvents} onSelectDay={handleSelectDay} />
      ) : (
        <MonthView jobs={[]} anchorDay={anchorDay} timeOffEvents={timeOffEvents} onSelectDay={handleSelectDay} />
      )}

      <Text style={styles.rangeSummary}>
        {startDate.length > 0 ? `Start: ${startDate}` : 'Start: not set'}
        {'  '}
        {endDate.length > 0 ? `End: ${endDate}` : 'End: not set'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  rangeSummary: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMutedDark,
  },
});
