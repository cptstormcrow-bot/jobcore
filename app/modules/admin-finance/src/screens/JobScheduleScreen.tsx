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
 * `@jobcore/ui`'s `DatePicker` is a date-only control (`YYYY-MM-DD` text
 * entry, no calendar popover, no time-of-day — see its own doc comment).
 * Since `scheduledStart`/`scheduledEnd` are full timestamps, each field is
 * composed from a `DatePicker` (date part) plus a plain `TextInput` (time
 * part, `HH:MM` 24-hour) — the same "validated text entry, no native
 * dependency" convention `DatePicker` itself follows, and the same
 * "local, honest formatter" pattern `PlanningScreen.tsx` uses for date
 * display (`@jobcore/ui` has no datetime formatter or time picker of its
 * own).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Card, Button, DatePicker, colors, spacing, radius, typography } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import type { JobRepository } from '../data/ports';
import { getModulePorts } from '../lib/module-ports';

export interface JobScheduleScreenProps {
  job: Job;
  jobRepository?: JobRepository;
  onBack?: () => void;
  /** Fires with the updated `Job` after a successful save, so a host (e.g. the Job Detail screen) can refresh its own copy. */
  onSaved?: (job: Job) => void;
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

export function JobScheduleScreen({ job, jobRepository: jobRepositoryProp, onBack, onSaved }: JobScheduleScreenProps) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const start = splitIsoDateTime(job.scheduledStart);
    const end = splitIsoDateTime(job.scheduledEnd);
    setStartDate(start.date);
    setStartTime(start.time);
    setEndDate(end.date);
    setEndTime(end.time);
    setSaveError(null);
    setSaved(false);
  }, [job.id]);

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack && (
          <View style={styles.backRow}>
            <Button label="Back to Job" variant="outline" size="sm" onPress={onBack} />
          </View>
        )}

        <Card style={styles.card}>
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.subtitle}>{job.address ?? job.description ?? job.id}</Text>

          <Text style={styles.sectionLabel}>Scheduled Start</Text>
          <View style={styles.dateTimeRow}>
            <DatePicker value={startDate} onChange={setStartDate} style={styles.dateField} />
            <TextInput
              style={styles.timeInput}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Scheduled start time"
            />
          </View>

          <Text style={styles.sectionLabel}>Scheduled End</Text>
          <View style={styles.dateTimeRow}>
            <DatePicker value={endDate} onChange={setEndDate} style={styles.dateField} />
            <TextInput
              style={styles.timeInput}
              value={endTime}
              onChangeText={setEndTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Scheduled end time"
            />
          </View>

          {saveError && <Text style={styles.errorText}>{saveError}</Text>}
          {saved && !saveError && <Text style={styles.hintText}>Schedule saved.</Text>}

          <View style={styles.actions}>
            <Button
              label={saving ? 'Saving...' : 'Save Schedule'}
              onPress={() => {
                void handleSave();
              }}
              disabled={saving}
              style={styles.action}
            />
          </View>
        </Card>
      </ScrollView>
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
    marginBottom: spacing.md,
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
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
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  action: {
    marginLeft: spacing.sm,
  },
});
