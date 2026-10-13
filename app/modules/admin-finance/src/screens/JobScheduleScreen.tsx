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
import { Card, Button, DatePicker, MonthView, CalendarHeader, Select, JobHeaderBlock, colors, spacing, radius, typography, Text } from '@jobcore/ui';
import * as Clipboard from 'expo-clipboard';
import { addMinutes, addMonths, format, subMonths } from 'date-fns';
import type { Job } from '@jobcore/core';
import type { JobRepository } from '../data/ports';
import { getModulePorts } from '../lib/module-ports';

export interface JobScheduleScreenProps {
  job: Job;
  jobRepository?: JobRepository;
  onBack?: () => void;
  /** Fires with the updated `Job` after a successful save, so a host (e.g. the Job Detail screen) can refresh its own copy. */
  onSaved?: (job: Job) => void;
  /** Inlined inside a host screen's own scroll view: suppresses the Back row and renders a plain `View` root instead of `ScrollView`. */
  embedded?: boolean;
  /** Sum of estimated task minutes for this job, when known; drives Stop = Start + this duration in `applyPickedDate` instead of the 60-minute fallback. */
  totalTaskMinutes?: number;
  /** Org's price-sheet standard duration (minutes), when known; the fallback default when no task minutes are available. */
  standardMinutes?: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 30-minute-step time-of-day quick picks, 7:00am-7:00pm inclusive. */
const TIME_OF_DAY_OPTIONS: Array<{ hh: number; mm: number; label: string }> = Array.from(
  { length: 25 },
  (_, i) => {
    const totalMinutes = 7 * 60 + i * 30;
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return { hh, mm, label: format(new Date(2000, 0, 1, hh, mm), 'h:mm a') };
  }
);

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

export function JobScheduleScreen({ job, jobRepository: jobRepositoryProp, onBack, onSaved, embedded, totalTaskMinutes, standardMinutes }: JobScheduleScreenProps) {
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

  function handleSelectDay(day: Date): void {
    setAnchorDay(day);
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      startPickerDate.getHours(),
      startPickerDate.getMinutes(),
      0,
      0
    );
    applyPickedDate('start', next);
    applyPickedDate('end', addMinutes(next, effectiveDefault));
  }

  function applyTimeOfDay(hh: number, mm: number): void {
    const next = new Date(
      startPickerDate.getFullYear(),
      startPickerDate.getMonth(),
      startPickerDate.getDate(),
      hh,
      mm,
      0,
      0
    );
    applyPickedDate('start', next);
    applyPickedDate('end', addMinutes(next, effectiveDefault));
  }

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
    if (start.value && end.value && start.value > end.value) {
      setSaveError('Scheduled start must be before scheduled end.');
      return;
    }

    const repo = jobRepositoryProp ?? getModulePorts().jobs;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await repo.updateDetails(job.id, {
        scheduledStart: start.value,
        scheduledEnd: end.value,
      });
      setSaved(true);
      onSaved?.(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the schedule.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
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
        <Button
          label="Pick date"
          variant="outline"
          size="sm"
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

  return (
    <View style={styles.screen}>
      <Root {...rootProps}>
        {!embedded && onBack && (
          <View style={styles.backRow}>
            <Button label="Back to Job" variant="outline" size="sm" onPress={onBack} />
          </View>
        )}

        <Card style={styles.card}>
          {!embedded && <Text style={styles.title}>Schedule</Text>}
          {!embedded && (
            <JobHeaderBlock
              customerName={job.customerName}
              address={job.address}
              phone={job.customerPhone}
              jobNumber={job.jobNumber}
              createdAt={job.createdAt}
              scheduledStart={job.scheduledStart}
              ingressCode={job.ingressInstructions}
              onCopy={async (text) => { await Clipboard.setStringAsync(text); }}
            />
          )}

          <CalendarHeader
            mode="month"
            onModeChange={() => {}}
            label={format(anchorDay, 'MMMM yyyy')}
            onPrev={() => setAnchorDay((d) => subMonths(d, 1))}
            onNext={() => setAnchorDay((d) => addMonths(d, 1))}
            onToday={() => setAnchorDay(new Date())}
          />
          <MonthView jobs={[]} anchorDay={anchorDay} onSelectDay={handleSelectDay} />

          <Text style={styles.sectionLabel}>Start time</Text>
          {renderFieldPicker('start')}

          <Text style={styles.sectionLabel}>Quick start time</Text>
          <Select
            value={`${startPickerDate.getHours()}-${startPickerDate.getMinutes()}`}
            options={TIME_OF_DAY_OPTIONS.map((opt) => ({
              label: opt.label,
              value: `${opt.hh}-${opt.mm}`,
            }))}
            placeholder="Select a time"
            onChange={(value) => {
              const [hhStr, mmStr] = value.split('-');
              applyTimeOfDay(Number(hhStr), Number(mmStr));
            }}
          />

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

          <View style={styles.actions}>
            <Button
              label="Clear schedule"
              variant="outline"
              onPress={handleClearSchedule}
              style={styles.action}
            />
            <Button label="Cancel" variant="outline" onPress={resetFromJob} style={styles.action} />
            <Button
              label={saving ? 'Saving...' : 'Save'}
              onPress={() => void handleSave()}
              disabled={saving}
              style={styles.action}
            />
          </View>
        </Card>
      </Root>
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
});
