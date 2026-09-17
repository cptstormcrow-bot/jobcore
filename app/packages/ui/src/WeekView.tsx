// P2e.2b/2c - Calendar week view with job_status colour bars. Role gate lives in calendar.tsx.
// Workstream H: also renders pre-filtered non-job layer events (e.g. time_off) passed in by
// calendar.tsx. WeekView stays a dumb renderer - it does no fetching or layer/role filtering
// of its own, it just draws whatever lists it's handed.
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from './tokens';
import type { Job } from '@jobcore/core';
import { addDays, startOfWeek, format, isSameDay } from 'date-fns';
import { JOB_STATUS_COLORS } from './job-status-colors';

/** Non-job calendar_events row (e.g. kind: 'time_off') - job_id is null so there's no Job to render. */
export interface TimeOffEvent {
  id: string;
  title: string | null;
  description: string | null;
  eventTime: string;
  techId?: string;
}

export interface WeekViewProps {
  jobs: Job[];
  anchorDay: Date;
  timeOffEvents?: TimeOffEvent[];
  onSelectJob?: (job: Job) => void;
  onSelectTimeOff?: (event: TimeOffEvent) => void;
  onSelectDay?: (day: Date) => void;
}


export function WeekView({ jobs, anchorDay, timeOffEvents = [], onSelectJob, onSelectTimeOff, onSelectDay }: WeekViewProps) {
  const weekStart = startOfWeek(anchorDay, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <ScrollView style={styles.verticalRoot}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.root}>
        {days.map((day) => {
          const dayJobs = jobs
            .filter((j) => j.scheduledStart && isSameDay(new Date(j.scheduledStart), day))
            .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
          const dayTimeOff = timeOffEvents
            .filter((t) => isSameDay(new Date(t.eventTime), day))
            .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
          const isAnchor = isSameDay(day, anchorDay);
          const isToday = isSameDay(day, new Date());
          const hasTimeOff = dayTimeOff.length > 0;

          return (
            <View key={day.toISOString()} style={styles.column}>
              <Pressable disabled={!onSelectDay} onPress={() => onSelectDay?.(day)} style={styles.headerPressable}>
                <Text
                  style={[styles.headerText, { color: isAnchor ? colors.primary : colors.textMuted }, isToday && styles.todayHeaderText]}
                  numberOfLines={1}
                >
                  {format(day, 'EEE')}
                </Text>
                <Text
                  style={[
                    styles.dayNumberText,
                    { color: isAnchor ? colors.primary : colors.textMuted },
                    isToday && styles.todayHeaderText,
                    hasTimeOff && styles.timeOffDayNumberText,
                  ]}
                  numberOfLines={1}
                >
                  {format(day, 'd')}
                </Text>
              </Pressable>
              {dayTimeOff.map((event) => (
                <Pressable key={event.id} disabled={!onSelectTimeOff} onPress={() => onSelectTimeOff?.(event)}>
                  <Text style={styles.timeOffLabel} numberOfLines={1}>
                    {event.title ?? 'Time off'}
                  </Text>
                </Pressable>
              ))}
              {dayJobs.slice(0, 3).map((job) => (
                <Pressable
                  key={job.id}
                  onPress={() => onSelectJob?.(job)}
                  style={[styles.card, { borderLeftWidth: 4, borderLeftColor: JOB_STATUS_COLORS[job.status] }]}
                >
                  <Text style={styles.cardTime} numberOfLines={1}>{format(new Date(job.scheduledStart!), 'h:mm a')}</Text>
                  <Text style={styles.cardAddress} numberOfLines={2} ellipsizeMode="tail">{job.address ?? 'No address'}</Text>
                </Pressable>
              ))}
              {dayJobs.length > 3 && (
                <Text style={styles.moreLabel} numberOfLines={1}>
                  +{dayJobs.length - 3} more
                </Text>
              )}
            </View>
          );
        })}
      </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  verticalRoot: {
    flex: 1,
  },
  root: {
    backgroundColor: colors.offWhite,
    flexDirection: 'row',
  },
  column: {
    width: 160,
    marginRight: spacing.sm,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    paddingHorizontal: spacing.xs,
  },
  headerPressable: {
    alignItems: 'center',
  },
  headerText: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.heading,
  },
  dayNumberText: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.heading,
  },
  todayHeaderText: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  timeOffDayNumberText: {
    color: colors.danger,
    fontWeight: '700',
  },
  timeOffLabel: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.body,
    color: colors.danger,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  cardTime: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.body,
    color: colors.textMuted,
  },
  cardAddress: {
    fontSize: typography.size.label,
    lineHeight: typography.size.label * typography.lineHeight.body,
    color: colors.text,
  },
  moreLabel: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
