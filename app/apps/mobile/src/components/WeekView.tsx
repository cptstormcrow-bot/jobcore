// P2e.2b/2c - Calendar week view with job_status colour bars. Role gate lives in calendar.tsx.
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import { addDays, startOfWeek, format, isSameDay } from 'date-fns';
import { JOB_STATUS_COLORS } from '../lib/job-status-colors';

export interface WeekViewProps {
  jobs: Job[];
  anchorDay: Date;
}

export function WeekView({ jobs, anchorDay }: WeekViewProps) {
  const weekStart = startOfWeek(anchorDay, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <ScrollView horizontal style={styles.root} contentContainerStyle={styles.content}>
      {days.map((day) => {
        const dayJobs = jobs
          .filter((j) => j.scheduledStart && isSameDay(new Date(j.scheduledStart), day))
          .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
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
              <View key={job.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: JOB_STATUS_COLORS[job.status] }]}>
                <Text style={styles.cardTime}>{format(new Date(job.scheduledStart!), 'h:mm a')}</Text>
                <Text style={styles.cardAddress}>{job.address ?? 'No address'}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
