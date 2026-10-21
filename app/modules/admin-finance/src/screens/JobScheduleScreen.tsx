// JobCore screen #0058 - job-region-schedule - Schedule
/**
 * Admin-only job scheduling panel.
 *
 * A `JobAction` target for the shared Job Detail screen (see
 * `@jobcore/module-sdk`'s `JobAction`): given the job already selected on
 * that screen, lets an admin pick a scheduled start/end date+time and save
 * it. Unlike `PlanningScreen.tsx` — which owns a job **list** and
 * self-selects a job before rendering its form — this screen is invoked
 * already scoped to one job (`JobAction.onInvoke(job: Job)` hands the job
 * over), so it takes `job: Job` directly rather than `jobs: Job[]` plus an
 * internal picker.
 *
 * Writes through `JobRepository.updateDetails` (the admin-finance repos'
 * `getModulePorts().jobs`, mirrors `PlanningScreen.tsx`'s
 * `getModulePorts().jobPlanning` self-injection pattern, with the same
 * prop-override escape hatch for callers/tests), patching only
 * `scheduledStart` / `scheduledEnd` on `JobDetailsPatch`. Deliberately NOT
 * `JobRepository.patchScheduling`/`JobSchedulingPatch` — that is a
 * different data seam (it also carries `assignedTechId`/`requestedWindow`)
 * belonging to the assignment-board flow; this screen only ever sends the
 * two schedule fields.
 *
 * Scheduled start/end are entered via the native
 * `@react-native-community/datetimepicker` control rather than free text:
 * on iOS an inline spinner (`mode="datetime"`) lets the admin scrub date and
 * time together; on Android — which has no combined spinner — a "Pick
 * date" button drives a native date dialog followed immediately by a
 * native time dialog, and the two selections are combined into one `Date`.
 * Both platforms funnel back into the same `startDate`/`startTime` (and
 * end) string state the save handler already validates via
 * `combineDateTime`/`splitIsoDateTime` above — only the input widget
 * changed, not the payload shape sent to `JobRepository.updateDetails`.
 *
 * `embedded` lets a host screen (e.g. Job Detail) inline this panel inside
 * its own scroll view: the Back row is suppressed (the host owns
 * navigation back) and the root becomes a plain `View` instead of a
 * `ScrollView` (the host supplies the scroll container). Non-embedded
 * behavior — used when this screen is pushed as its own route — is
 * unchanged.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card, PayrollButton, TimeRangePopup, defaultEnd, JobHeaderBlock, JobTitleBarHeader, formatJobHeaderLines, formatScheduleLabel, colors, spacing, radius, typography, Text } from '@jobcore/ui';
import * as Clipboard from 'expo-clipboard';
import type { Job } from '@jobcore/core';
import type { JobRepository } from '../data/ports';
import { getModulePorts } from '../lib/module-ports';
import { UniversalCalendar, type UniversalCalendarEmployee } from './UniversalCalendar';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';

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
  /** Sum of estimated task minutes for this job, when known; drives Stop = Start + this duration in `applyPickedDate` instead of the 60-minute fallback. */
  totalTaskMinutes?: number;
  /** Org's price-sheet standard duration (minutes), when known; the fallback default when no task minutes are available. */
  standardMinutes?: number;
  /** Assigned tech's display name, shown in the top band; absent renders a dash. */
  assignedTechName?: string;
  /** Prem tech's display name, shown in the top band; absent renders a dash. */
  premTechName?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Local, honest split — @jobcore/ui's DatePicker has no time-of-day support. */
function splitIsoDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) {
    return { date: '', time: '' };
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '', time: '' };
  }
  const yyyy = String(parsed.getFullYear()).padStart(4, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const min = String(parsed.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

type CombineResult = { value: string | null; error: string | null };

/**
 * Local, honest combine — the mirror of `splitIsoDateTime` above. Empty
 * date + empty time together mean "clear the schedule" (`null`); either
 * one filled in without the other is a validation error, not a silent
 * partial save.
 */
function combineDateTime(date: string, time: string, label: string): CombineResult {
  const d = date.trim();
  const t = time.trim();
  if (!d && !t) {
    return { value: null, error: null };
  }
  if (!ISO_DATE_RE.test(d)) {
    return { value: null, error: `Enter a valid ${label} date as YYYY-MM-DD.` };
  }
  if (!TIME_RE.test(t)) {
    return { value: null, error: `Enter a valid ${label} time as HH:MM (24-hour).` };
  }
  const [year, month, day] = d.split('-').map(Number);
  const [hour, minute] = t.split(':').map(Number);
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined) {
    return { value: null, error: `Enter a valid ${label} date and time.` };
  }
  const composed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(composed.getTime())) {
    return { value: null, error: `Enter a valid ${label} date and time.` };
  }
  return { value: composed.toISOString(), error: null };
}

/** `Date` → the `startDate`/`startTime` (or end) string pair the save handler validates. */
function dateToParts(d: Date): { date: string; time: string } {
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toLocalInputValue = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

type ScheduleField = 'start' | 'end';
type AndroidStage = 'date' | 'time';
type AndroidPickerState = { field: ScheduleField; stage: AndroidStage; datePart: Date } | null;
type TimePopupState = { mode: 'pick' | 'edit'; day: Date } | null;

export function JobScheduleScreen({ job, jobRepository: jobRepositoryProp, onBack, onOpenCalendar, onSaved, embedded, totalTaskMinutes, standardMinutes, assignedTechName, premTechName }: JobScheduleScreenProps) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Local `Date` state driving the native pickers, derived from the ISO
  // strings on `job` (falls back to "now" when unset, matching the pickers'
  // own default-value expectations).
  const [startPickerDate, setStartPickerDate] = useState<Date>(() => (job.scheduledStart ? new Date(job.scheduledStart) : new Date()));
  const [endPickerDate, setEndPickerDate] = useState<Date>(() => (job.scheduledEnd ? new Date(job.scheduledEnd) : new Date()));
  const [androidPicker, setAndroidPicker] = useState<AndroidPickerState>(null);
  const [anchorDay, setAnchorDay] = useState<Date>(() => new Date());
  const [timePopup, setTimePopup] = useState<TimePopupState>(null);

  function resetFromJob(): void {
    const start = splitIsoDateTime(job.scheduledStart);
    const end = splitIsoDateTime(job.scheduledEnd);
    setStartDate(start.date);
    setStartTime(start.time);
    setEndDate(end.date);
    setEndTime(end.time);
    setStartPickerDate(job.scheduledStart ? new Date(job.scheduledStart) : new Date());
    setEndPickerDate(job.scheduledEnd ? new Date(job.scheduledEnd) : new Date());
    setSaveError(null);
    setSaved(false);
    setAnchorDay(job.scheduledStart ? new Date(job.scheduledStart) : new Date());
  }

  useEffect(() => {
    resetFromJob();
  }, [job.id]);

  // Fallback-only: no price-sheet `estimated_minutes` is currently loaded
  // by this screen (it is never fetched here — see PriceSheetRateWithTaskRow
  // in `price-sheet-repo.ts`, which is keyed by service/task, not by job,
  // and this screen has no such lookup wired). Until that plumbing exists,
  // every Start change pushes Stop out by this fixed duration.
  const effectiveDefault = standardMinutes ?? 60;

  function applyPickedDate(field: ScheduleField, next: Date) {
    const parts = dateToParts(next);
    if (field === 'start') {
      setStartPickerDate(next);
      setStartDate(parts.date);
      setStartTime(parts.time);
      // Requirement: Start moving always overwrites Stop to Start + duration
      // (price-sheet estimated minutes when available, else the standard
      // duration fallback above). Stop remains independently editable otherwise.
      const effectiveDurationMinutes =
        totalTaskMinutes && totalTaskMinutes > 0 ? totalTaskMinutes : effectiveDefault;
      const nextEnd = new Date(next.getTime() + effectiveDurationMinutes * 60000);
      const endParts = dateToParts(nextEnd);
      setEndPickerDate(nextEnd);
      setEndDate(endParts.date);
      setEndTime(endParts.time);
    } else {
      setEndPickerDate(next);
      setEndDate(parts.date);
      setEndTime(parts.time);
    }
  }

  const [calJobs, setCalJobs] = useState<Job[]>([]);
  const [calEmployees, setCalEmployees] = useState<UniversalCalendarEmployee[]>([]);
  const [calTimeOff, setCalTimeOff] = useState<TimeOffRequestAdmin[]>([]);
  const [timeOffRev, setTimeOffRev] = useState(0);

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
        setCalJobs(jobsList);
        setCalEmployees(profiles.map((p) => ({ id: p.id, fullName: p.fullName, role: p.role, active: p.active })));
        setCalTimeOff(timeOff);
      } catch {
        // leave arrays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job.organizationId, timeOffRev]);

  function handleClearSchedule(): void {
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
    setSaveError(null);
    setSaved(false);
  }

  function handleAndroidChange(field: ScheduleField, stage: AndroidStage, event: { type: string }, picked?: Date) {
    if (event.type !== 'set' || !picked) {
      setAndroidPicker(null);
      return;
    }
    if (stage === 'date') {
      // Date leg chosen — immediately chain into the time leg for the same field.
      setAndroidPicker({ field, stage: 'time', datePart: picked });
      return;
    }
    // Time leg chosen — combine the previously-picked date with this time and commit.
    const base = androidPicker?.datePart ?? (field === 'start' ? startPickerDate : endPickerDate);
    const combined = new Date(base.getFullYear(), base.getMonth(), base.getDate(), picked.getHours(), picked.getMinutes(), 0, 0);
    applyPickedDate(field, combined);
    setAndroidPicker(null);
  }

  // Persistence core shared by Save, the time popup's Save and Cancel visit.
  // Both values null means unscheduled (the job stays open).
  async function persistSchedule(startIso: string | null, endIso: string | null): Promise<void> {
    if (startIso && endIso && startIso > endIso) {
      setSaveError('Scheduled start must be before scheduled end.');
      return;
    }

    const repo = jobRepositoryProp ?? getModulePorts().jobs;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await repo.updateDetails(job.id, {
        scheduledStart: startIso,
        scheduledEnd: endIso,
      });
      const s = splitIsoDateTime(startIso);
      const e = splitIsoDateTime(endIso);
      setStartDate(s.date);
      setStartTime(s.time);
      setEndDate(e.date);
      setEndTime(e.time);
      setStartPickerDate(startIso ? new Date(startIso) : new Date());
      setEndPickerDate(endIso ? new Date(endIso) : new Date());
      setCalJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      setSaved(true);
      onSaved?.(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the schedule.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelVisit(): Promise<void> {
    await persistSchedule(null, null);
    setTimePopup(null);
  }

  // start/end are 'HH:MM' on the popup's day (end is the same day as start).
  async function handlePopupSave(start: string, end: string): Promise<void> {
    if (!timePopup) {
      return;
    }
    const d = timePopup.day;
    const dayStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const s = combineDateTime(dayStr, start, 'start');
    if (s.error) {
      setSaveError(s.error);
      return;
    }
    const e = combineDateTime(dayStr, end, 'end');
    if (e.error) {
      setSaveError(e.error);
      return;
    }
    await persistSchedule(s.value, e.value);
    setTimePopup(null);
  }

  // Other jobs' scheduled visits on the given local calendar day.
  function otherVisitsOn(day: Date): number {
    return calJobs.filter((j) => {
      if (j.id === job.id || !j.scheduledStart) {
        return false;
      }
      const at = new Date(j.scheduledStart);
      return at.getFullYear() === day.getFullYear() && at.getMonth() === day.getMonth() && at.getDate() === day.getDate();
    }).length;
  }

  function popupInitial(p: NonNullable<TimePopupState>): { start: string; end: string } {
    if (p.mode === 'edit') {
      return { start: startTime, end: endTime };
    }
    return { start: '08:00', end: defaultEnd('08:00', totalTaskMinutes && totalTaskMinutes > 0 ? totalTaskMinutes : effectiveDefault) };
  }

  async function handleSave() {
    if (saving) {
      return;
    }
    const start = combineDateTime(startDate, startTime, 'start');
    if (start.error) {
      setSaveError(start.error);
      return;
    }
    const end = combineDateTime(endDate, endTime, 'end');
    if (end.error) {
      setSaveError(end.error);
      return;
    }
    await persistSchedule(start.value, end.value);
  }

  function renderFieldPicker(field: ScheduleField) {
    const pickerDate = field === 'start' ? startPickerDate : endPickerDate;
    const displayText =
      field === 'start'
        ? startDate && startTime
          ? startPickerDate.toLocaleString()
          : 'Not set'
        : endDate && endTime
          ? endPickerDate.toLocaleString()
          : 'Not set';

    if (Platform.OS === 'web') {
      return React.createElement('input', {
        type: 'datetime-local',
        value: toLocalInputValue(pickerDate),
        onChange: (e: { target: { value: string } }) => {
          if (e.target.value) applyPickedDate(field, new Date(e.target.value));
        },
      });
    }

    if (Platform.OS === 'ios') {
      return (
        <View>
          <DateTimePicker
            mode="datetime"
            display="spinner"
            value={pickerDate}
            onChange={(_event, picked) => {
              if (picked) {
                applyPickedDate(field, picked);
              }
            }}
          />
          <Text style={styles.hintText}>{displayText}</Text>
        </View>
      );
    }

    const activeForField = androidPicker?.field === field ? androidPicker : null;
    return (
      <View>
        <PayrollButton
          label="Pick date"
          onPress={() => setAndroidPicker({ field, stage: 'date', datePart: pickerDate })}
        />
        <Text style={styles.hintText}>{displayText}</Text>
        {activeForField?.stage === 'date' && (
          <DateTimePicker
            mode="date"
            display="default"
            value={pickerDate}
            onChange={(event, picked) => handleAndroidChange(field, 'date', event, picked)}
          />
        )}
        {activeForField?.stage === 'time' && (
          <DateTimePicker
            mode="time"
            display="default"
            value={activeForField.datePart}
            onChange={(event, picked) => handleAndroidChange(field, 'time', event, picked)}
          />
        )}
      </View>
    );
  }

  const Root = embedded ? View : ScrollView;
  const rootProps = embedded ? {} : { contentContainerStyle: styles.content };
  const popupInit = timePopup ? popupInitial(timePopup) : { start: '08:00', end: '09:00' };
  const popupVisits = timePopup ? otherVisitsOn(timePopup.day) : 0;

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

          <View style={styles.topBand}>
            <View style={styles.techCol}>
              <Text style={styles.techLine}>Tech: {assignedTechName ?? '—'}</Text>
              <Text style={styles.techLine}>Prem Tech: {premTechName ?? '—'}</Text>
            </View>
            <View style={styles.actions}>
              <PayrollButton label="Clear Schedule" onPress={handleClearSchedule} style={styles.action} />
              <PayrollButton
                label={saving ? 'Saving...' : 'Save'}
                onPress={() => void handleSave()}
                disabled={saving}
                style={styles.action}
              />
              <PayrollButton label="Cancel" onPress={resetFromJob} style={styles.action} />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Start time</Text>
          {renderFieldPicker('start')}

          <Text style={styles.sectionLabel}>End time (auto)</Text>
          <Text style={styles.hintText}>
            {endDate && endTime ? `Scheduled for ${endPickerDate.toLocaleString()}` : 'Not set'}
          </Text>

          {(() => {
            const delta = (totalTaskMinutes ?? 0) - effectiveDefault;
            return (
              <Text style={styles.hintText}>
                Estimated: {totalTaskMinutes ?? 0} min · Standard: {effectiveDefault} min ·{' '}
                {delta >= 0 ? '+' + delta : delta} min vs. standard
              </Text>
            );
          })()}

          {saveError && <Text style={styles.errorText}>{saveError}</Text>}
          {saved && !saveError && (
            <Text style={styles.hintText}>Scheduled for {startPickerDate.toLocaleString()}</Text>
          )}

          <View style={{ height: 420 }}>
            <UniversalCalendar
              role="admin"
              viewerId={null}
              anchorDate={anchorDay}
              initialMode="month"
              jobs={calJobs}
              employees={calEmployees}
              timeOffRequests={calTimeOff}
              onSelectJob={(j) => {
                if (j.id === job.id) {
                  setTimePopup({ mode: 'edit', day: j.scheduledStart ? new Date(j.scheduledStart) : anchorDay });
                }
              }}
              onSaveBlackouts={async (isoDays, techId) => {
                for (const day of isoDays) {
                  await getModulePorts().timeOffAdmin.createBlackout(job.organizationId, techId, { startDate: day, endDate: day, reason: null });
                }
                setTimeOffRev((n) => n + 1);
              }}
              onSubmitTimeOff={async (draft, techId) => {
                await getModulePorts().timeOffAdmin.createBlackout(job.organizationId, techId, draft);
                setTimeOffRev((n) => n + 1);
              }}
              onCancelTimeOff={async (requestId) => {
                await getModulePorts().timeOffAdmin.cancel(requestId);
                setTimeOffRev((n) => n + 1);
              }}
              renderDayActions={(day) => (
                <View style={{ marginVertical: spacing.xs }}>
                  <PayrollButton label="Set time" onPress={() => setTimePopup({ mode: 'pick', day })} testID="schedule-set-time" />
                </View>
              )}
            />
          </View>
        </Card>
      </Root>
      <TimeRangePopup
        visible={timePopup !== null}
        title={timePopup?.mode === 'edit' ? 'Reschedule' : 'Set time'}
        date={timePopup?.day ?? anchorDay}
        initialStart={popupInit.start}
        initialEnd={popupInit.end}
        onSave={handlePopupSave}
        onClose={() => setTimePopup(null)}
        onCancelVisit={timePopup?.mode === 'edit' ? handleCancelVisit : undefined}
        note={popupVisits > 0 ? `${popupVisits} other visit${popupVisits === 1 ? '' : 's'} this day` : undefined}
      />
    </View>
  );
}

export default JobScheduleScreen;

const styles = StyleSheet.create({
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthTitle: {
    fontSize: typography.size.h6,
    fontWeight: typography.weight.semibold,
    color: colors.text,
  },
  timeOfDayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
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
  sectionLabel: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  timeInput: {
    width: spacing.xxl * 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
    backgroundColor: colors.surface,
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
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  action: {
    marginLeft: spacing.sm,
  },
  topBand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  techCol: {
    flexShrink: 1,
  },
  techLine: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
});
