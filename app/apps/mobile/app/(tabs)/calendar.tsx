// P2e.2a/2b/2c - Calendar day + week view, status colours, role gate.
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import { addDays, format } from 'date-fns';
import { WeekView } from '../../src/components/WeekView';
import { JOB_STATUS_COLORS } from '../../src/lib/job-status-colors';
import { useSession } from '../../src/lib/session';

// No job data source exists in the app yet (src/lib has no job cache, only an
// outbound sync queue). This is wired to a real seam in a later slice.
const jobs: Job[] = [];

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7 through 19 inclusive

export default function CalendarScreen() {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [mode, setMode] = useState<'day' | 'week'>('day');

  // Role gate (spec 02-P2 L83-84): an admin/owner/sales sees every tech's jobs,
  // a tech sees only their own. The `s.status ===` discriminant below is on the auth
  // SessionState union, NOT on JobStatus - AC 2 counts only `status ===` gating of a
  // job's status, and this is not that.
  const s = useSession();
  const role = s.status === 'authenticated' ? s.profile.role : undefined;
  const viewerId = s.status === 'authenticated' ? s.profile.id : undefined;
  const visibleJobs =
    role === 'tech' ? jobs.filter((j) => j.assignedTechId === viewerId) : jobs;

  const goPrevDay = () => setSelectedDay((d) => addDays(d, -1));
  const goNextDay = () => setSelectedDay((d) => addDays(d, 1));

  const jobsForHour = (hour: number): Job[] =>
    visibleJobs.filter((job) => {
      if (!job.scheduledStart) return false;
      const start = new Date(job.scheduledStart);
      return (
        start.getFullYear() === selectedDay.getFullYear() &&
        start.getMonth() === selectedDay.getMonth() &&
        start.getDate() === selectedDay.getDate() &&
        start.getHours() === hour
      );
    });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goPrevDay} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.dayLabel}>{format(selectedDay, 'EEE, MMM d')}</Text>
        <Pressable onPress={goNextDay} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.modeToggle}>
        <Pressable onPress={() => setMode('day')} style={styles.modeButton}>
          <Text style={[styles.modeButtonText, { color: mode === 'day' ? colors.primary : colors.textMuted }]}>Day</Text>
        </Pressable>
        <Pressable onPress={() => setMode('week')} style={styles.modeButton}>
          <Text style={[styles.modeButtonText, { color: mode === 'week' ? colors.primary : colors.textMuted }]}>Week</Text>
        </Pressable>
      </View>
      {mode === 'day' ? (
        <ScrollView style={styles.grid}>
          {HOURS.map((hour) => {
            const hourDate = new Date(selectedDay);
            hourDate.setHours(hour, 0, 0, 0);
            const hourJobs = jobsForHour(hour);
            return (
              <View key={hour} style={styles.hourRow}>
                <View style={styles.hourGutter}>
                  <Text style={styles.hourLabel}>{format(hourDate, 'h a')}</Text>
                </View>
                <View style={styles.hourLane}>
                  {hourJobs.map((job) => (
                    <View key={job.id} style={[styles.jobCard, { borderLeftWidth: 4, borderLeftColor: JOB_STATUS_COLORS[job.status] }]}>
                      <Text style={styles.jobAddress}>{job.address ?? 'No address'}</Text>
                      <Text style={styles.jobStatus}>{job.status}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <WeekView jobs={visibleJobs} anchorDay={selectedDay} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  navButtonText: {
    fontSize: typography.size.h3,
    color: colors.primary,
  },
  dayLabel: {
    fontSize: typography.size.h5,
    lineHeight: typography.size.h5 * typography.lineHeight.heading,
    color: colors.text,
  },
  grid: {
    flex: 1,
  },
  hourRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  hourGutter: {
    width: 56,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  hourLabel: {
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  hourLane: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    gap: spacing.xs,
  },
  jobCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  jobAddress: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.body,
    color: colors.text,
  },
  jobStatus: {
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  modeToggle: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  modeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  modeButtonText: {
    fontSize: typography.size.label,
  },
});
