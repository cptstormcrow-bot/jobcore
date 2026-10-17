// Day view - every job for one day grouped by technician, with time-off blackouts. Dumb renderer.
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, typography, spacing, radius } from './tokens';
import type { Job } from '@jobcore/core';
import { format, isSameDay } from 'date-fns';
import { JOB_STATUS_COLORS, JOB_STATUS_GLYPHS } from './job-status-colors';
import type { TimeOffEvent } from './WeekView';

export interface DayViewProps {
  date: Date;
  jobs: Job[];
  timeOff: TimeOffEvent[];
  techs?: { id: string; name: string }[];
  techFilterId?: string | null;
  highlightJobId?: string | null;
  onJobPress?: (job: Job) => void;
}

interface Group {
  key: string;
  title: string;
  blackouts: TimeOffEvent[];
  jobs: Job[];
}

export function DayView({ date, jobs, timeOff, techs = [], techFilterId, highlightJobId, onJobPress }: DayViewProps) {
  const byTime = (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime();
  const dayJobs = jobs
    .filter((j) => j.scheduledStart && isSameDay(new Date(j.scheduledStart), date))
    .sort((a, b) => byTime(a.scheduledStart!, b.scheduledStart!));
  const dayOff = timeOff
    .filter((t) => isSameDay(new Date(t.eventTime), date))
    .sort((a, b) => byTime(a.eventTime, b.eventTime));

  const groups: Group[] = [];
  const shopWide = dayOff.filter((t) => !t.techId);
  if (shopWide.length > 0) groups.push({ key: '__all', title: 'All techs', blackouts: shopWide, jobs: [] });

  const techIds: string[] = [];
  for (const t of techs) techIds.push(t.id);
  for (const j of dayJobs) if (j.assignedTechId && !techIds.includes(j.assignedTechId)) techIds.push(j.assignedTechId);
  for (const t of dayOff) if (t.techId && !techIds.includes(t.techId)) techIds.push(t.techId);

  for (const id of techIds) {
    if (techFilterId && id !== techFilterId) continue;
    const gj = dayJobs.filter((j) => j.assignedTechId === id);
    const gb = dayOff.filter((t) => t.techId === id);
    if (gj.length === 0 && gb.length === 0) continue;
    groups.push({ key: id, title: techs.find((t) => t.id === id)?.name ?? 'Unassigned', blackouts: gb, jobs: gj });
  }
  if (!techFilterId) {
    const unassigned = dayJobs.filter((j) => !j.assignedTechId);
    if (unassigned.length > 0) groups.push({ key: '__none', title: 'Unassigned', blackouts: [], jobs: unassigned });
  }

  return (
    <ScrollView style={styles.root}>
      {groups.length === 0 && <Text style={styles.empty}>Nothing scheduled</Text>}
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text style={styles.groupTitle}>{g.title}</Text>
          {g.blackouts.map((t) => (
            <View key={t.id} style={styles.blackout}>
              <Text style={styles.blackoutText}>
                {format(new Date(t.eventTime), 'h:mma')} {t.title ?? 'Time off'}
              </Text>
            </View>
          ))}
          {g.jobs.map((job) => (
            <Pressable
              key={job.id}
              onPress={() => onJobPress?.(job)}
              style={[
                styles.card,
                { borderLeftWidth: 4, borderLeftColor: JOB_STATUS_COLORS[job.status] },
                job.id === highlightJobId && styles.highlight,
              ]}
            >
              <Text style={styles.cardTime}>
                {JOB_STATUS_GLYPHS[job.status]} {format(new Date(job.scheduledStart!), 'h:mma')}
              </Text>
              <Text style={styles.cardAddress} numberOfLines={2} ellipsizeMode="tail">
                {job.address ?? 'No address'}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { color: colors.textMuted, padding: spacing.md, textAlign: 'center' },
  group: { marginBottom: spacing.md },
  groupTitle: { fontWeight: '700', color: colors.textMuted, marginBottom: spacing.xs, fontSize: typography.size.small },
  blackout: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  blackoutText: { color: '#FFFFFF' },
  card: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  highlight: { borderWidth: 2, borderColor: colors.gold },
  cardTime: { fontWeight: '600' },
  cardAddress: { color: colors.textMuted },
});
