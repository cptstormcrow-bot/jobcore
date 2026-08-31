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
}

export function WeekView({ jobs, anchorDay, timeOffEvents = [], onSelectJob }: WeekViewProps) {
  const weekStart = startOfWeek(anchorDay, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <ScrollView style={styles.verticalRoot}>
      <ScrollView horizontal style={styles.root} contentContainerStyle={styles.content}>
        {days.map((day) => {
          const dayJobs = jobs
            .filter((j) => j.scheduledStart && isSameDay(new Date(j.scheduledStart), day))
            .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
          const dayTimeOff = timeOffEvents
            .filter((t) => isSameDay(new Date(t.eventTime), day))
            .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
          const isAnchor = isSameDay(day, anchorDay);

          return (
            <View key={day.toISOString()} style={styles.column}>
              <Text style={[styles.headerText, { color: isAnchor ? colors.primary : colors.textMuted }]}>
                {format(day, 'EEE')}
              </Text>
              <Text style={[styles.headerText, { color: isAnchor ? colors.primary : colors.textMuted }]}>
                {format(day, 'M/d')}
              </Text>
              {dayJobs.map((job) => (
                <Pressable
                  key={job.id}
                  onPress={() => onSelectJob?.(job)}
                  style={[styles.card, { borderLeftWidth: 4, borderLeftColor: JOB_STATUS_COLORS[job.status] }]}
                >
                  <Text style={styles.cardTime}>{format(new Date(job.scheduledStart!), 'h:mm a')}</Text>
                  <Text style={styles.cardAddress}>{job.address ?? 'No address'}</Text>
                </Pressable>
              ))}
              {dayTimeOff.map((event) => (
                <View key={event.id} style={[styles.card, styles.timeOffCard]}>
                  <Text style={styles.cardTime}>{format(new Date(event.eventTime), 'h:mm a')}</Text>
                  <Text style={styles.cardAddress}>{event.title ?? 'Time off'}</Text>
                </View>
              ))}
            </View>
          );
        })}
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
  },
  content: {
    flexDirection: 'row',
  },
  column: {
    width: 140,
    marginRight: spacing.sm,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    paddingHorizontal: spacing.xs,
  },
  headerText: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.heading,
  },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  timeOffCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.textMuted,
    backgroundColor: colors.offWhite,
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
});
