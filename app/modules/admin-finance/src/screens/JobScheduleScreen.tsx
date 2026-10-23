// JobCore screen #0058 - job-region-schedule - Schedule
/**
 * Admin-only job scheduling panel ("Calendar Redux").
 *
 * A `JobAction` target for the shared Job Detail screen: given the job already
 * selected on that screen, lets an admin pick a scheduled start date+time on an
 * inline month calendar with hour / minute / AM-PM columns (`SchedulePicker`
 * from `@jobcore/ui`) and save it. The SAVED slot is shown in bold above the
 * calendar. Save / Clear / Cancel sit in a row at the top:
 *   - Save is enabled only when the picked start differs from the saved start.
 *   - Clear empties the picked start (draft only).
 *   - Cancel discards the draft and returns the picker to the saved slot.
 * Changing an already-saved slot asks "Reschedule?" (Yes saves and logs a
 * `reschedule` calendar event; No behaves like Cancel). Clearing a saved slot
 * and saving asks "Remove from schedule?" (Yes persists null start/end).
 *
 * The calendar shows every schedulable job and every blackout (time-off
 * request); each is tappable for a detail popup (name / address / phone /
 * description) with a link that switches to that job via `onOpenJob`.
 * `showBlackouts` (job Options menu "Blackout Dates?") toggles the red
 * blackouts. The end time is derived: picked start + the saved duration, else
 * the job's task minutes, else the standard minutes, else 60.
 *
 * Writes through `JobRepository.updateDetails` (the admin-finance repos'
 * `getModulePorts().jobs`, with a prop-override escape hatch for callers and
 * tests), patching only `scheduledStart` / `scheduledEnd`.
 *
 * `embedded` lets a host screen (e.g. Job Detail) inline this panel inside its
 * own scroll view: the Back row and title block are suppressed and the root
 * becomes a plain `View` instead of a `ScrollView`.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, ScrollView, StyleSheet } from 'react-native';
import {
  Card,
  PayrollButton,
  JobHeaderBlock,
  JobTitleBarHeader,
  formatJobHeaderLines,
  formatScheduleLabel,
  SchedulePicker,
  ScheduleItemPopup,
  formatSlotHeading,
  slotsEqual,
  slotDurationMinutes,
  deriveEndIso,
  colors,
  spacing,
  radius,
  typography,
  Text,
} from '@jobcore/ui';
import type { ScheduleItemDetail } from '@jobcore/ui';
import * as Clipboard from 'expo-clipboard';
import type { Job } from '@jobcore/core';
import type { JobRepository } from '../data/ports';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';
import { getModulePorts } from '../lib/module-ports';
import {
  blackoutScheduleDetail,
  buildScheduleItems,
  jobScheduleDetail,
  scheduleItemRef,
} from '../domain/schedule-items';
import type { ScheduleEmployee, ScheduleItem } from '../domain/schedule-items';

export interface JobScheduleScreenProps {
  job: Job;
  jobRepository?: JobRepository;
  onBack?: () => void;
  /** Opens the calendar from the title bar's schedule link; absent means the label is plain text. */
  onOpenCalendar?: () => void;
  /** Fires with the updated `Job` after a successful save, so a host (e.g. the Job Detail screen) can refresh its own copy. */
  onSaved?: (job: Job) => void;
  /** Inlined inside a host screen's own scroll view: suppresses the Back row and renders a plain `View` root instead of `ScrollView`. */
  embedded?: boolean;
  /** Sum of estimated task minutes for this job, when known; the fallback duration when no slot is saved yet. */
  totalTaskMinutes?: number;
  /** Org's price-sheet standard duration (minutes), when known; the next fallback duration. */
  standardMinutes?: number;
  /** Show the red blackout days on the calendar (job Options menu "Blackout Dates?"). Default true. */
  showBlackouts?: boolean;
  /** Switches the host to another job (the popup's "Open job" link). */
  onOpenJob?: (jobId: string) => void;
}

type SavedSlot = { start: string | null; end: string | null };
type ConfirmKind = 'reschedule' | 'remove' | null;

export function JobScheduleScreen({
  job,
  jobRepository: jobRepositoryProp,
  onBack,
  onOpenCalendar,
  onSaved,
  embedded,
  totalTaskMinutes,
  standardMinutes,
  showBlackouts,
  onOpenJob,
}: JobScheduleScreenProps) {
  const [saved, setSaved] = useState<SavedSlot>({ start: job.scheduledStart ?? null, end: job.scheduledEnd ?? null });
  const [draftStart, setDraftStart] = useState<string | null>(job.scheduledStart ?? null);
  const [pickerKey, setPickerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [popupDetail, setPopupDetail] = useState<ScheduleItemDetail | null>(null);

  const [feedJobs, setFeedJobs] = useState<Job[]>([]);
  const [feedEmployees, setFeedEmployees] = useState<ScheduleEmployee[]>([]);
  const [feedTimeOff, setFeedTimeOff] = useState<TimeOffRequestAdmin[]>([]);
  const [feedRev, setFeedRev] = useState(0);
  const popupToken = useRef(0);

  // Re-sync the saved slot when the parent hands us a new schedule for this job.
  useEffect(() => {
    const start = job.scheduledStart ?? null;
    const end = job.scheduledEnd ?? null;
    setSaved((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [job.id, job.scheduledStart, job.scheduledEnd]);

  // Whenever the saved slot changes, the draft and picker return to it.
  useEffect(() => {
    setDraftStart(saved.start);
    setPickerKey((k) => k + 1);
  }, [saved]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ports = getModulePorts();
        const orgId = job.organizationId;
        const [jobsList, profiles, timeOff] = await Promise.all([
          ports.jobs.listForOrganization(orgId),
          ports.employees.listEmployees(orgId),
          ports.timeOffAdmin.listForOrganization(orgId),
        ]);
        if (cancelled) return;
        setFeedJobs(jobsList);
        setFeedEmployees(profiles.map((p) => ({ id: p.id, fullName: p.fullName })));
        setFeedTimeOff(timeOff);
      } catch {
        // leave the feeds as they are
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job.organizationId, feedRev]);

  const duration = slotDurationMinutes(saved.start, saved.end, totalTaskMinutes || standardMinutes);
  const draftEnd = draftStart ? deriveEndIso(draftStart, duration) : null;
  const changed = !slotsEqual({ startIso: draftStart, endIso: null }, { startIso: saved.start, endIso: null });

  const items: ScheduleItem[] = buildScheduleItems({
    jobs: feedJobs,
    timeOff: feedTimeOff,
    employees: feedEmployees,
    currentJobId: job.id,
  });

  function resetDraft(): void {
    setDraftStart(saved.start);
    setPickerKey((k) => k + 1);
  }

  function handleCancel(): void {
    setConfirmKind(null);
    setPopupDetail(null);
    setErrorText(null);
    resetDraft();
  }

  function handleClear(): void {
    setDraftStart(null);
    setErrorText(null);
  }

  // Persists a new start (end derived) or null/null; resolves to the updated job, or null on failure.
  async function persist(newStart: string | null): Promise<Job | null> {
    const newEnd = newStart ? deriveEndIso(newStart, duration) : null;
    const repo = jobRepositoryProp ?? getModulePorts().jobs;
    setBusy(true);
    setErrorText(null);
    setNoticeText(null);
    try {
      const updated = await repo.updateDetails(job.id, {
        scheduledStart: newStart,
        scheduledEnd: newEnd,
      });
      setSaved({ start: newStart, end: newEnd });
      setDraftStart(newStart);
      setPickerKey((k) => k + 1);
      setFeedJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      setFeedRev((n) => n + 1);
      onSaved?.(updated);
      return updated;
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : 'Could not save the schedule.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmReschedule(): Promise<void> {
    setConfirmKind(null);
    const oldStart = saved.start;
    const oldEnd = saved.end;
    const newStart = draftStart;
    const newEnd = draftEnd;
    const updated = await persist(newStart);
    if (!updated) return;
    try {
      await getModulePorts().calendarEvents.create(job.organizationId, {
        jobId: job.id,
        kind: 'reschedule',
        title: `Rescheduled: ${formatSlotHeading(oldStart, oldEnd)} -> ${formatSlotHeading(newStart, newEnd)}`,
        eventTime: new Date().toISOString(),
      });
    } catch {
      setNoticeText('Saved, but the reschedule note could not be recorded.');
    }
  }

  async function confirmRemove(): Promise<void> {
    setConfirmKind(null);
    await persist(null);
  }

  function handleSave(): void {
    if (busy || !changed) return;
    if (saved.start === null) {
      void persist(draftStart);
    } else if (draftStart === null) {
      setConfirmKind('remove');
    } else {
      setConfirmKind('reschedule');
    }
  }

  function handleSelectItem(item: { id: string; startIso: string; endIso: string | null; isCurrent?: boolean }): void {
    const ref = scheduleItemRef(item.id);
    if (!ref) return;
    const whenLabel = formatSlotHeading(item.startIso, item.endIso);
    const token = ++popupToken.current;
    if (ref.kind === 'job') {
      const target = ref.ref === job.id ? job : feedJobs.find((j) => j.id === ref.ref);
      if (!target) return;
      const detail: ScheduleItemDetail = jobScheduleDetail(target, whenLabel);
      if (item.isCurrent) detail.openJobId = null;
      setPopupDetail(detail);
      if (target.customerId) {
        getModulePorts()
          .customers.getById(target.customerId)
          .then((customer) => {
            if (!customer || !customer.phone || popupToken.current !== token) return;
            const phone = customer.phone;
            setPopupDetail((d) => (d && d.kind === 'job' ? { ...d, phone } : d));
          })
          .catch(() => {
            // no phone shown
          });
      }
      return;
    }
    const request = feedTimeOff.find((r) => r.id === ref.ref);
    if (!request) return;
    const employee = feedEmployees.find((e) => e.id === request.techId);
    setPopupDetail(blackoutScheduleDetail(request, employee?.fullName, whenLabel));
  }

  function closePopup(): void {
    popupToken.current += 1;
    setPopupDetail(null);
  }

  const Root = embedded ? View : ScrollView;
  const rootProps = embedded ? {} : { contentContainerStyle: styles.content };

  return (
    <View style={styles.screen}>
      <Root {...rootProps}>
        {!embedded && onBack && (
          <View style={styles.backRow}>
            <PayrollButton label="Back to Job" onPress={onBack} />
          </View>
        )}

        <Card style={styles.card}>
          {!embedded && <Text style={styles.title}>Schedule #0058</Text>}
          {!embedded && (
            <>
              <JobTitleBarHeader
                framed
                inset={5}
                jobLine={formatJobHeaderLines(job.jobNumber, job.createdAt).jobLine}
                dateLine={formatJobHeaderLines(job.jobNumber, job.createdAt).dateLine}
                scheduleLabel={formatScheduleLabel(job.scheduledStart)}
                onSchedulePress={onOpenCalendar}
                customerName={job.customerName}
                address={job.address}
                phone={job.customerPhone}
                ingressCode={job.ingressInstructions}
                onCopy={async (text) => { await Clipboard.setStringAsync(text); }}
              />
              <JobHeaderBlock
                hideJobLine
                jobNumber={job.jobNumber}
                createdAt={job.createdAt}
                scheduledStart={job.scheduledStart}
              />
            </>
          )}

          <View style={styles.actions}>
            <PayrollButton
              label={busy ? 'Saving...' : 'Save'}
              onPress={handleSave}
              disabled={!changed || busy}
              testID="schedule-save"
            />
            <PayrollButton label="Clear" onPress={handleClear} disabled={busy} testID="schedule-clear" />
            <PayrollButton label="Cancel" onPress={handleCancel} disabled={busy} testID="schedule-cancel" />
          </View>

          {errorText && <Text style={styles.errorText}>{errorText}</Text>}
          {noticeText && !errorText && <Text style={styles.hintText}>{noticeText}</Text>}

          <Text style={styles.heading} testID="schedule-heading">
            {formatSlotHeading(saved.start, saved.end)}
          </Text>

          <SchedulePicker
            key={pickerKey}
            value={draftStart}
            onChange={setDraftStart}
            items={items}
            showBlackouts={showBlackouts ?? true}
            onSelectItem={handleSelectItem}
            initialMonthIso={saved.start}
          />
        </Card>
      </Root>

      <ScheduleItemPopup
        visible={popupDetail !== null}
        detail={popupDetail}
        onClose={closePopup}
        onOpenJob={(jobId) => {
          closePopup();
          onOpenJob?.(jobId);
        }}
      />

      <Modal
        visible={confirmKind !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              {confirmKind === 'remove' ? 'Remove from schedule?' : 'Reschedule?'}
            </Text>
            {confirmKind === 'reschedule' && (
              <>
                <Text style={styles.dialogLine}>From: {formatSlotHeading(saved.start, saved.end)}</Text>
                <Text style={styles.dialogLine}>To: {formatSlotHeading(draftStart, draftEnd)}</Text>
              </>
            )}
            {confirmKind === 'remove' && (
              <Text style={styles.dialogLine}>Currently: {formatSlotHeading(saved.start, saved.end)}</Text>
            )}
            <View style={styles.actions}>
              <PayrollButton
                label="Yes"
                onPress={() => void (confirmKind === 'remove' ? confirmRemove() : confirmReschedule())}
                disabled={busy}
                testID={confirmKind === 'remove' ? 'schedule-remove-yes' : 'schedule-reschedule-yes'}
              />
              <PayrollButton
                label="No"
                onPress={handleCancel}
                testID={confirmKind === 'remove' ? 'schedule-remove-no' : 'schedule-reschedule-no'}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default JobScheduleScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
    marginBottom: spacing.xs,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.headingBold,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '90%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  dialogTitle: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.headingBold,
    marginBottom: spacing.sm,
  },
  dialogLine: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.xs,
  },
});
