/**
 * DateRangeCalendar — hand-rolled month-grid date-range picker for `TimeOff.tsx`
 * (Workstream F, 4a).
 *
 * Reuses the `date-fns` calendar-grid pattern already established in
 * `apps/mobile/src/components/WeekView.tsx` (`addDays`, `startOfWeek`,
 * `format`, `isSameDay`), extended here to a full month grid with
 * `startOfMonth`/`endOfMonth`/`endOfWeek`/`addMonths`/`subMonths` for
 * month navigation, and `isWithinInterval`/`isBefore` to shade the
 * selected start–end range. No new native dependency — `date-fns` only,
 * matching the plan's constraint.
 *
 * Controlled component: the parent (`TimeOff.tsx`) owns `startDate`/
 * `endDate` as ISO `YYYY-MM-DD` strings and passes `onChangeStartDate`/
 * `onChangeEndDate`. Tap behavior: the first tap (or a tap before the
 * current start) sets the start date and clears the end date; the next
 * tap sets the end date (swapping if it lands before the new start).
 * This is intentionally simple — no drag-select, matching the plain
 * hex-color local-StyleSheet house style already used by `TimeOff.tsx`
 * rather than pulling in `@jobcore/ui` tokens.
 */

import * as React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  addDays,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isBefore,
  isWithinInterval,
} from 'date-fns';

export interface DateRangeCalendarProps {
  /** ISO `YYYY-MM-DD`, or empty string when unset. */
  startDate: string;
  /** ISO `YYYY-MM-DD`, or empty string when unset. */
  endDate: string;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
  disabled?: boolean;
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
}: DateRangeCalendarProps): React.ReactElement {
  const parsedStart = parseIsoDate(startDate);
  const parsedEnd = parseIsoDate(endDate);

  const [visibleMonth, setVisibleMonth] = React.useState<Date>(parsedStart ?? new Date());

  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let day = gridStart; !isBefore(gridEnd, day); day = addDays(day, 1)) {
    days.push(day);
  }

  function handleSelectDay(day: Date): void {
    if (disabled) {
      return;
    }
    if (parsedStart === null || parsedEnd !== null) {
      onChangeStartDate(toIsoDate(day));
      onChangeEndDate('');
      return;
    }
    if (isBefore(day, parsedStart)) {
      onChangeStartDate(toIsoDate(day));
      onChangeEndDate(toIsoDate(parsedStart));
      return;
    }
    onChangeEndDate(toIsoDate(day));
  }

  function isInRange(day: Date): boolean {
    if (parsedStart === null || parsedEnd === null) {
      return false;
    }
    return isWithinInterval(day, { start: parsedStart, end: parsedEnd });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => setVisibleMonth((prev) => subMonths(prev, 1))}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{format(visibleMonth, 'MMMM yyyy')}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => setVisibleMonth((prev) => addMonths(prev, 1))}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>{'›'}</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => (
          <Text key={`${label}-${i}`} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const inCurrentMonth = isSameMonth(day, visibleMonth);
          const isStart = parsedStart !== null && isSameDay(day, parsedStart);
          const isEnd = parsedEnd !== null && isSameDay(day, parsedEnd);
          const inRange = isInRange(day);

          return (
            <Pressable
              key={day.toISOString()}
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => handleSelectDay(day)}
              style={[
                styles.dayCell,
                inRange && styles.dayCellInRange,
                (isStart || isEnd) && styles.dayCellSelected,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  !inCurrentMonth && styles.dayTextMuted,
                  (isStart || isEnd) && styles.dayTextSelected,
                ]}
              >
                {format(day, 'd')}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  navButtonText: {
    fontSize: 18,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#777',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellInRange: {
    backgroundColor: '#eef4ff',
  },
  dayCellSelected: {
    backgroundColor: '#3366ff',
    borderRadius: 999,
  },
  dayText: {
    fontSize: 13,
  },
  dayTextMuted: {
    color: '#bbb',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  rangeSummary: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
});
