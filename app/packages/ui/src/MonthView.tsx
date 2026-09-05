import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import type { Job } from '@jobcore/core';
import type { TimeOffEvent } from './WeekView';
import { colors, spacing } from './tokens';
import { JOB_STATUS_COLORS } from './job-status-colors';

export interface MonthViewProps {
  jobs: Job[];
  anchorDay: Date;
  timeOffEvents?: TimeOffEvent[];
  onSelectDay?: (day: Date) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MonthView({ jobs, anchorDay, timeOffEvents = [], onSelectDay }: MonthViewProps) {
  const gridStart = startOfWeek(startOfMonth(anchorDay), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(anchorDay), { weekStartsOn: 0 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const rows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }

  return (
    <View>
      <View style={styles.header}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={[styles.dayText, styles.dayTextMuted, { width: `${100 / 7}%` }]}>
            {label}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row[0].toISOString()} style={styles.row}>
          {row.map((day) => {
            const dayJobs = jobs.filter((j) => j.scheduledStart && isSameDay(new Date(j.scheduledStart), day));
            const dayStart = startOfDay(day);
            const hasTimeOff = timeOffEvents.some((t) => {
              const start = startOfDay(new Date((t as any).startDate ?? t.eventTime));
              const end = startOfDay(new Date((t as any).endDate ?? t.eventTime));
              return isWithinInterval(dayStart, { start, end });
            });
            const inMonth = isSameMonth(day, anchorDay);
            const selected = isSameDay(day, anchorDay);
            const today = isToday(day);

            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => onSelectDay?.(day)}
                style={[styles.cell, selected && styles.cellSelected]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !inMonth && styles.dayTextMuted,
                    today && styles.dayTextToday,
                    selected && styles.dayTextSelected,
                    hasTimeOff && styles.dayTextTimeOff,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                <View style={styles.dotsRow}>
                  {dayJobs.slice(0, 3).map((job) => (
                    <View
                      key={job.id}
                      style={[styles.dot, { backgroundColor: JOB_STATUS_COLORS[job.status] ?? colors.primary }]}
                    />
                  ))}
                  {dayJobs.length > 3 && <Text style={styles.moreText}>+{dayJobs.length - 3}</Text>}
                </View>
                {hasTimeOff && <View style={styles.timeOffBar} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: `${100 / 7}%`,
    minHeight: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 4,
  },
  cellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: 12,
    color: colors.text,
  },
  dayTextMuted: {
    color: colors.textMuted,
  },
  dayTextToday: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  dayTextSelected: {
    color: '#fff',
  },
  dayTextTimeOff: {
    color: '#D32F2F',
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  moreText: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 2,
  },
  timeOffBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.danger,
  },
});
