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
  onAddJob?: (day: Date) => void;
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
  return (
    <Modal visible={day !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView>
            {day !== null ? (
              <>
                <Text style={styles.title}>{format(day, 'EEEE, MMM d')}</Text>
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
                <View style={styles.actions}>
                  {onAddJob ? <PayrollButton label="Add Job" onPress={() => onAddJob(day)} /> : null}
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

const styles = StyleSheet.create({
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
