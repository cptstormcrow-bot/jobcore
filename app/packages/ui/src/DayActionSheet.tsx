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
  /** Jobs ready to schedule (estimate approved, tech assigned, not yet scheduled). Shown as a pick list. */
  schedulableJobs?: Job[];
  /** Confirm with a picked job and time schedules that job on the tapped day. Should throw on failure. */
  onConfirmSchedule?: (job: Job, day: Date, time: string) => Promise<void>;
  /** #0058 reschedule: move a scheduled job to the picked time on this day. Should throw on failure. */
  onRescheduleJob?: (job: Job, day: Date, time: string) => Promise<void>;
  /** #0058 clear: take a scheduled job off the schedule. Should throw on failure. */
  onClearJob?: (job: Job) => Promise<void>;
  /** Tap a job row to see its details popup (#0058 ScheduleItemPopup). */
  onJobInfo?: (job: Job) => void;
  /** Tap a blackout row to see its details popup. */
  onBlackoutInfo?: (blackout: DayActionBlackout) => void;
}

const MINUTES = ['00', '15', '30', '45'];

/** Replace the minutes of an "h:mm a" string. */
function withMinute(time: string, mm: string): string {
  return time.replace(/:\d\d/, `:${mm}`);
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
  schedulableJobs,
  onConfirmSchedule,
  onRescheduleJob,
  onClearJob,
  onJobInfo,
  onBlackoutInfo,
}: DayActionSheetProps) {
  // Optional start time for Add Job, e.g. "9:00 AM". Cleared each time the sheet opens on a new day.
  const [time, setTime] = React.useState<string | null>(null);
  const [pickedJobId, setPickedJobId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Pending reschedule/clear confirmation for one job (#0058 asks "Reschedule?" / "Remove from schedule?").
  const [pending, setPending] = React.useState<{ jobId: string; kind: 'move' | 'clear' } | null>(null);
  React.useEffect(() => {
    setPending(null);
    setTime(null);
    setPickedJobId(null);
    setError(null);
  }, [day]);
  const readyJobs = onConfirmSchedule ? schedulableJobs ?? [] : [];
  const pickedJob = readyJobs.find((j) => j.id === pickedJobId) ?? null;
  const confirm = async (d: Date, t: string): Promise<void> => {
    if (pickedJob && onConfirmSchedule) {
      setBusy(true);
      setError(null);
      try {
        await onConfirmSchedule(pickedJob, d, t);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not schedule the job.');
      } finally {
        setBusy(false);
      }
      return;
    }
    onAddJob?.(d, t);
  };
  const runPending = async (job: Job, d: Date): Promise<void> => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'move' && time && onRescheduleJob) await onRescheduleJob(job, d, time);
      if (pending.kind === 'clear' && onClearJob) await onClearJob(job);
      setPending(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the schedule.');
    } finally {
      setBusy(false);
    }
  };
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
                  <View key={job.id} style={styles.jobBlock}>
                    <View style={styles.rowInner}>
                      <Pressable style={styles.rowText} onPress={onJobInfo ? () => onJobInfo(job) : undefined}>
                        <Text numberOfLines={1} style={styles.rowTitle}>{job.address ?? 'No address'}</Text>
                        <Text numberOfLines={1} style={styles.rowMeta}>
                          {[job.customerName, job.scheduledStart ? format(new Date(job.scheduledStart), 'h:mm a') : null]
                            .filter(Boolean)
                            .join('  •  ')}
                        </Text>
                      </Pressable>
                      {onOpenJob ? <PayrollButton label="Job details" onPress={() => onOpenJob(job)} /> : null}
                    </View>
                    {onRescheduleJob || onClearJob ? (
                      pending?.jobId === job.id ? (
                        <View style={styles.pendingRow}>
                          <Text style={styles.rowMeta}>
                            {pending.kind === 'move' ? `Reschedule to ${time}?` : 'Remove from schedule?'}
                          </Text>
                          {!busy ? <PayrollButton label="Yes" onPress={() => void runPending(job, day)} /> : null}
                          <PayrollButton label="No" onPress={() => setPending(null)} />
                        </View>
                      ) : (
                        <View style={styles.pendingRow}>
                          {onRescheduleJob && time ? (
                            <PayrollButton label={`Move to ${time}`} onPress={() => setPending({ jobId: job.id, kind: 'move' })} />
                          ) : null}
                          {onClearJob ? (
                            <PayrollButton label="Remove from schedule" onPress={() => setPending({ jobId: job.id, kind: 'clear' })} />
                          ) : null}
                        </View>
                      )
                    ) : null}
                  </View>
                ))}
                {blackouts.map((b) => (
                  <View key={b.id} style={styles.row}>
                    <Pressable style={styles.rowText} onPress={onBlackoutInfo ? () => onBlackoutInfo(b) : undefined}>
                      <Text numberOfLines={1} style={styles.blackoutTitle}>{b.title ?? 'Blackout'}</Text>
                    </Pressable>
                    {onOpenBlackout ? (
                      <PayrollButton label="Blackout details" onPress={() => onOpenBlackout(b)} />
                    ) : null}
                  </View>
                ))}
                {readyJobs.length > 0 ? (
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>Ready to schedule (tap one, pick a time, Confirm)</Text>
                    {readyJobs.map((job) => (
                      <Pressable
                        key={job.id}
                        onPress={() => setPickedJobId(pickedJobId === job.id ? null : job.id)}
                        style={[styles.readyRow, pickedJobId === job.id ? styles.chipOn : null]}
                      >
                        <Text numberOfLines={1} style={pickedJobId === job.id ? styles.chipTextOn : styles.chipText}>
                          {[job.address ?? 'No address', job.customerName].filter(Boolean).join('  •  ')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {onAddJob || (onConfirmSchedule && pickedJob) || (onRescheduleJob && jobs.length > 0) ? (
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
                    {time ? (
                      <View style={styles.minuteRow}>
                        <Text style={styles.timeLabel}>Minute</Text>
                        {MINUTES.map((mm) => (
                          <Pressable
                            key={mm}
                            onPress={() => setTime(withMinute(time, mm))}
                            style={[styles.chip, time.includes(`:${mm}`) ? styles.chipOn : null]}
                          >
                            <Text style={time.includes(`:${mm}`) ? styles.chipTextOn : styles.chipText}>{`:${mm}`}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <View style={styles.actions}>
                  {(onAddJob || pickedJob) && time && !busy ? (
                    <PayrollButton label="Confirm" onPress={() => void confirm(day, time)} />
                  ) : null}
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
  readyRow: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  errorText: { fontSize: 12, color: colors.danger, marginTop: spacing.sm },
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
  jobBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  rowInner: { flexDirection: 'row', alignItems: 'center' },
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  minuteRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  rowText: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: typography.text.body, color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted },
  blackoutTitle: { fontSize: typography.text.body, color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
});
