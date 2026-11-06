/**
 * DayActionSheet: the tap-a-day sheet, modeled on the #0025 DayList day popup.
 * Shows the day's jobs and blackouts, each with a details button, plus Add Job / Add Blackout.
 * Shared by every calendar so a day tap behaves the same everywhere (Jeff 2026-11-05).
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { format } from 'date-fns';
import type { Job } from '@jobcore/core';
import { Text } from './Text';
import { PayrollButton } from './PayrollButton';
import { colors, radius, spacing, typography } from './tokens';

export interface DayActionBlackout {
  id: string;
  title?: string | null;
}

export interface DayActionSheetProps {
  /** The tapped day. null hides the sheet. */
  day: Date | null;
  jobs: Job[];
  blackouts: DayActionBlackout[];
  onClose: () => void;
  /** Omit to hide the Add Job button. */
  onAddJob?: (day: Date, time: string | null) => void;
  /** Omit to hide the Add Blackout button. */
  onAddBlackout?: (day: Date) => void;
  onOpenJob?: (job: Job) => void;
  onOpenBlackout?: (blackout: DayActionBlackout) => void;
  /** Omit to hide the Open day view button. */
  onOpenDayView?: (day: Date) => void;
}

export function DayActionSheet({
  day,
  jobs,
  blackouts,
  onClose,
  onAddJob,
  onAddBlackout,
  onOpenJob,
  onOpenBlackout,
  onOpenDayView,
}: DayActionSheetProps) {
  // Optional start time for Add Job, e.g. "9:00 AM". Cleared each time the sheet opens on a new day.
  const [time, setTime] = React.useState<string | null>(null);
  React.useEffect(() => setTime(null), [day]);
  return (
    <Modal visible={day !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView>
            {day !== null ? (
              <>
                <Text style={styles.title}>{`Scheduled: ${format(day, 'EEEE MMM d')}`}</Text>
                {jobs.length === 0 && blackouts.length === 0 ? (
                  <Text style={styles.empty}>Nothing scheduled.</Text>
                ) : null}
                {jobs.map((job) => (
                  <View key={job.id} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{job.address ?? 'No address'}</Text>
                      <Text numberOfLines={1} style={styles.rowMeta}>
                        {[job.customerName, job.scheduledStart ? format(new Date(job.scheduledStart), 'h:mm a') : null]
                          .filter(Boolean)
                          .join('  •  ')}
                      </Text>
                    </View>
                    {onOpenJob ? <PayrollButton label="Job details" onPress={() => onOpenJob(job)} /> : null}
                  </View>
                ))}
                {blackouts.map((b) => (
                  <View key={b.id} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text numberOfLines={1} style={styles.blackoutTitle}>{b.title ?? 'Blackout'}</Text>
                    </View>
                    {onOpenBlackout ? (
                      <PayrollButton label="Blackout details" onPress={() => onOpenBlackout(b)} />
                    ) : null}
                  </View>
                ))}
                {onAddJob ? (
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>{time ? `Start time: ${time}` : 'Start time (optional)'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {TIME_SLOTS.map((slot) => (
                        <Pressable
                          key={slot}
                          onPress={() => setTime(time === slot ? null : slot)}
                          style={[styles.chip, time === slot ? styles.chipOn : null]}
                        >
                          <Text numberOfLines={1} style={time === slot ? styles.chipTextOn : styles.chipText}>{slot}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                <View style={styles.actions}>
                  {onAddJob && time ? <PayrollButton label="Confirm" onPress={() => onAddJob(day, time)} /> : null}
                  {onAddJob ? <PayrollButton label="Add Job" onPress={() => onAddJob(day, time)} /> : null}
                  {onAddBlackout ? <PayrollButton label="Add Blackout" onPress={() => onAddBlackout(day)} /> : null}
                  {onOpenDayView ? <PayrollButton label="Open day view" onPress={() => onOpenDayView(day)} /> : null}
                  <PayrollButton label="Close" onPress={onClose} />
                </View>
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Half-hour slots, 6:00 AM to 8:00 PM. */
const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = 6 * 60; m <= 20 * 60; m += 30) {
    out.push(format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), 'h:mm a'));
  }
  return out;
})();

const styles = StyleSheet.create({
  timeBlock: { marginTop: spacing.md },
  timeLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: typography.text.body, color: colors.text },
  chipTextOn: { fontSize: typography.text.body, color: colors.white },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  title: { fontSize: typography.text.title, fontWeight: '600', marginBottom: spacing.sm },
  empty: { fontSize: typography.text.body, color: colors.textMuted, paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: typography.text.body, color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted },
  blackoutTitle: { fontSize: typography.text.body, color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
});
