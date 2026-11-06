/**
 * DayActionSheet: the tap-a-day sheet, modeled on the #0025 DayList day popup.
 * Shows the day's jobs and blackouts, each with a details button, plus Add Job / Add Time-off.
 * Shared by every calendar so a day tap behaves the same everywhere (Jeff 2026-11-05).
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { format } from 'date-fns';
import type { Job } from '@jobcore/core';
import { Text } from './Text';
import { PayrollButton } from './PayrollButton';
import { TimePicker } from './TimePicker';
import { colors, radius, spacing, typography } from './tokens';

export interface DayActionBlackout {
  id: string;
  title?: string | null;
  /** The time-off reason or notes, shown in the popup. */
  description?: string | null;
}

export interface DayActionSheetProps {
  /** Tap-to-copy for job name, address and phone. Omit and those lines are plain text. */
  onCopy?: (text: string) => void;
  /** One-tap Time-off for the logged-in tech: sets this day red. Should throw on failure. */
  onQuickTimeOff?: (day: Date) => Promise<void> | void;
  /** The tapped day. null hides the sheet. */
  day: Date | null;
  jobs: Job[];
  blackouts: DayActionBlackout[];
  onClose: () => void;
  /** Omit to hide the Add Job button. */
  onAddJob?: (day: Date, time: string | null) => void;
  /** Omit to hide the Add Time-off button. */
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
  /** Admin only: shows a Clear button beside Time-off details that cancels that time-off request. */
  onClearBlackout?: (blackout: DayActionBlackout) => void;
  /**
   * When the host screen owns the hour picker (the calendar header), it passes the picked time here
   * and the sheet shows no picker of its own.
   */
  time?: string | null;
  /** With `time`: lets the sheet show a small picker to reschedule a job without leaving the popup. */
  onTimeChange?: (time: string | null) => void;
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
  onClearBlackout,
  time: hostTime,
  onTimeChange,
  onCopy,
  onQuickTimeOff,
}: DayActionSheetProps) {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copyLine = (text: string): void => {
    onCopy?.(text);
    setCopied(text);
  };
  const copyable = (text: string, style: object, key: string, lines = 1): JSX.Element =>
    onCopy ? (
      <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Copy ${text}`} onPress={() => copyLine(text)}>
        <Text numberOfLines={lines} style={style}>{copied === text ? `${text}  (copied)` : text}</Text>
      </Pressable>
    ) : (
      <Text key={key} numberOfLines={lines} style={style}>{text}</Text>
    );
  // Optional start time for Add Job, e.g. "9:00 AM". Cleared each time the sheet opens on a new day.
  const [ownTime, setTime] = React.useState<string | null>(null);
  const hostOwnsTime = hostTime !== undefined;
  const time = hostOwnsTime ? hostTime : ownTime;
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
    setCopied(null);
  }, [day]);
  const quickTimeOff = async (d: Date): Promise<void> => {
    if (!onQuickTimeOff) return;
    setBusy(true);
    setError(null);
    try {
      await onQuickTimeOff(d);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set time-off.');
    } finally {
      setBusy(false);
    }
  };
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
                <Text style={styles.title}>{format(day, 'EEEE, MMMM d, yyyy')}</Text>
                {jobs.length === 0 && blackouts.length === 0 ? (
                  <Text style={styles.empty}>Nothing scheduled.</Text>
                ) : null}
                {jobs.map((job) => (
                  <View key={job.id} style={styles.jobBlock}>
                    <View style={styles.rowInner}>
                      <View style={styles.rowText}>
                        {job.customerName ? copyable(job.customerName, styles.rowTitle, 'name') : null}
                        {copyable(job.address ?? 'No address', styles.rowTitle, 'addr', 2)}
                        {job.customerPhone ? copyable(job.customerPhone, styles.rowTitle, 'phone') : null}
                        {job.scheduledStart ? (
                          <Text style={styles.rowMeta}>{format(new Date(job.scheduledStart), 'h:mm a')}</Text>
                        ) : null}
                        {job.description ? <Text style={styles.jobDesc}>{job.description}</Text> : null}
                      </View>
                      {onJobInfo ? <PayrollButton label="Info" onPress={() => onJobInfo(job)} /> : null}
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
                      <Text style={styles.blackoutTitle}>{b.title ?? 'Time-off'}</Text>
                      {b.description ? <Text style={styles.jobDesc}>{b.description}</Text> : null}
                    </Pressable>
                    {onOpenBlackout ? (
                      <PayrollButton label="Time-off details" onPress={() => onOpenBlackout(b)} />
                    ) : null}
                    {onClearBlackout ? (
                      <PayrollButton label="Clear" accessibilityLabel="Clear time-off" testID={`day-sheet-clear-${b.id}`} onPress={() => onClearBlackout(b)} />
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
                {!hostOwnsTime && (onAddJob || (onConfirmSchedule && pickedJob) || (onRescheduleJob && jobs.length > 0)) ? (
                  <View style={styles.timeBlock}>
                    <TimePicker value={time} onChange={setTime} />
                  </View>
                ) : hostOwnsTime && onTimeChange && onRescheduleJob && jobs.length > 0 ? (
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>Reschedule: pick a new time, then tap Move</Text>
                    <TimePicker value={time} onChange={onTimeChange} />
                  </View>
                ) : hostOwnsTime ? (
                  <Text style={styles.timeLabel}>{time ? `Start time: ${time}` : 'Pick an hour below the calendar'}</Text>
                ) : null}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <View style={styles.actions}>
                  {(onAddJob || pickedJob) && time && !busy ? (
                    <PayrollButton label="Confirm" onPress={() => void confirm(day, time)} />
                  ) : null}
                  {onAddJob ? <PayrollButton label="Add Job" onPress={() => onAddJob(day, time)} /> : null}
                  {onQuickTimeOff && blackouts.length === 0 && !busy ? (
                    <PayrollButton label="Time-off" onPress={() => void quickTimeOff(day)} />
                  ) : null}
                  {onAddBlackout && !onQuickTimeOff ? (
                    <PayrollButton label="Add Time-off" onPress={() => onAddBlackout(day)} />
                  ) : null}
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
  jobDesc: { fontSize: 12, color: colors.text, marginTop: spacing.xs },
  blackoutTitle: { fontSize: typography.text.body, color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
});
