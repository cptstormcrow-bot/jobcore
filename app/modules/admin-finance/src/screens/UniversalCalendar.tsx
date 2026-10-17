// JobCore shared Universal Calendar (admin + tech) - month/week/day with blackout day-picking.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { addDays, addMonths, addWeeks, subMonths, subWeeks, format, startOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Button, SAND_BG, TechSelect, WeekView, MonthView, DayView, CalendarHeader, colors, spacing, radius } from '@jobcore/ui';
import type { TimeOffEvent, CalendarMode } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';

export function parseCalendarDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid calendar date "${dateOnly}"`);
  }
  return new Date(year, month - 1, day);
}

export function toCalendarTimeOffEvents(
  requests: TimeOffRequestAdmin[],
  techNameById: Map<string, string>,
): TimeOffEvent[] {
  const events: TimeOffEvent[] = [];
  for (const request of requests) {
    if (request.status === 'cancelled' || request.status === 'denied') continue;
    const start = parseCalendarDate(request.startDate);
    const end = parseCalendarDate(request.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }
    const techName = techNameById.get(request.techId) ?? 'Unknown tech';
    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      events.push({
        id: `${request.id}-${cursor.toISOString().slice(0, 10)}`,
        title: `${techName}: Time off`,
        description: request.reason,
        eventTime: cursor.toISOString(),
        techId: request.techId,
      });
      cursor = addDays(cursor, 1);
    }
  }
  return events;
}

export interface UniversalCalendarEmployee {
  id: string;
  fullName: string;
  role: string;
  active: boolean;
}

export interface UniversalCalendarProps {
  role: 'admin' | 'tech';
  viewerId: string | null;
  defaultFilters?: { techId?: string | null };
  jobs: Job[];
  employees: UniversalCalendarEmployee[];
  timeOffRequests: TimeOffRequestAdmin[];
  anchorDate?: Date;
  initialMode?: CalendarMode;
  returnLabel?: string;
  onReturn?: () => void;
  onSelectJob: (job: Job) => void;
  onSaveBlackouts: (isoDays: string[], techId: string) => Promise<void> | void;
}

export function UniversalCalendar(props: UniversalCalendarProps): React.JSX.Element {
  const { role, viewerId, defaultFilters, jobs, employees, timeOffRequests, returnLabel, onReturn, onSelectJob, onSaveBlackouts } = props;
  const [mode, setMode] = useState<CalendarMode>(props.initialMode ?? 'month');
  const [anchor, setAnchor] = useState<Date>(props.anchorDate ?? new Date());
  const [techFilter, setTechFilter] = useState<string | null>(
    role === 'tech' ? viewerId : defaultFilters?.techId ?? null,
  );
  const [pickDays, setPickDays] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveTechId = role === 'tech' ? viewerId : techFilter;
  const techs = employees.filter((e) => e.role === 'tech' && e.active);
  const techNameById = new Map(techs.map((t) => [t.id, t.fullName]));

  const calendarJobs = jobs
    .filter((job) => job.scheduledStart && (!effectiveTechId || job.assignedTechId === effectiveTechId))
    .map((job) =>
      !effectiveTechId
        ? { ...job, address: `${techNameById.get(job.assignedTechId ?? '') ?? 'Unassigned'}: ${job.address ?? 'No address'}` }
        : job,
    );
  const timeOffEvents = toCalendarTimeOffEvents(timeOffRequests, techNameById).filter(
    (e) => !effectiveTechId || e.techId === effectiveTechId,
  );

  function handlePrev(): void {
    setAnchor((prev) => (mode === 'month' ? subMonths(prev, 1) : mode === 'day' ? addDays(prev, -1) : subWeeks(prev, 1)));
  }
  function handleNext(): void {
    setAnchor((prev) => (mode === 'month' ? addMonths(prev, 1) : mode === 'day' ? addDays(prev, 1) : addWeeks(prev, 1)));
  }
  function handleToday(): void {
    setAnchor(mode === 'month' ? startOfMonth(new Date()) : new Date());
  }

  function toggle(isoDay: string): void {
    setPicked((prev) => (prev.includes(isoDay) ? prev.filter((d) => d !== isoDay) : [...prev, isoDay]));
  }

  async function handleSave(): Promise<void> {
    if (!effectiveTechId || picked.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveBlackouts(picked, effectiveTechId);
      setPicked([]);
      setPickDays(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save blackouts');
    } finally {
      setSaving(false);
    }
  }

  function handleTogglePick(): void {
    if (pickDays) setPicked([]);
    setError(null);
    setPickDays((v) => !v);
  }

  const label =
    mode === 'month'
      ? format(anchor, 'MMMM yyyy')
      : mode === 'week'
        ? `${format(startOfWeek(anchor, { weekStartsOn: 0 }), 'MMM d')} – ${format(endOfWeek(anchor, { weekStartsOn: 0 }), 'MMM d, yyyy')}`
        : format(anchor, 'EEE, MMM d, yyyy');

  return (
    <View style={styles.screen}>
      {returnLabel && onReturn ? (
        <Pressable onPress={onReturn} accessibilityRole="button" style={styles.returnLink}>
          <Text style={styles.returnText}>{`‹ ${returnLabel}`}</Text>
        </Pressable>
      ) : null}
      <CalendarHeader
        mode={mode}
        onModeChange={setMode}
        label={label}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />
      <View style={styles.actionRow}>
        {role === 'admin' ? (
          <TechSelect
            label="Technicians"
            value={techFilter}
            onChange={(v) => setTechFilter(v === '' ? null : v)}
            placeholder="All Techs"
            options={[{ label: 'All Techs', value: '' }, ...techs.map((t) => ({ label: t.fullName, value: t.id }))]}
            style={styles.techSelect}
          />
        ) : null}
        <View testID="calendar-blackouts-toggle">
          <Button variant="primary" label={pickDays ? 'Cancel' : 'Blackouts'} onPress={handleTogglePick} />
        </View>
      </View>
      {pickDays ? (
        <View style={styles.pickBar}>
          <Text style={styles.pickText}>Tap days to black out</Text>
          {role === 'admin' && !effectiveTechId ? <Text style={styles.hint}>Pick a technician first</Text> : null}
          <View testID="calendar-blackouts-save">
            <Button
              variant="primary"
              label={`Save ${picked.length} day(s)`}
              disabled={picked.length === 0 || saving || !effectiveTechId}
              onPress={() => {
                void handleSave();
              }}
            />
          </View>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {mode === 'month' ? (
        <MonthView
          variant="list"
          jobs={calendarJobs}
          anchorDay={anchor}
          timeOffEvents={timeOffEvents}
          selectedDays={picked}
          onDayPress={pickDays ? toggle : undefined}
          onSelectDay={(d) => {
            setAnchor(d);
            setMode('day');
          }}
          onSelectJob={onSelectJob}
        />
      ) : mode === 'week' ? (
        <WeekView
          jobs={calendarJobs}
          anchorDay={anchor}
          timeOffEvents={timeOffEvents}
          onSelectJob={onSelectJob}
          onDayPress={pickDays ? (d) => toggle(format(d, 'yyyy-MM-dd')) : undefined}
        />
      ) : (
        <DayView date={anchor} jobs={calendarJobs} timeOff={timeOffEvents} onJobPress={onSelectJob} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.xs, padding: spacing.xs },
  returnLink: { paddingVertical: spacing.xs },
  returnText: { color: colors.primary },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  techSelect: { width: 150 },
  pickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: SAND_BG,
    borderRadius: radius.md,
  },
  pickText: { color: colors.text },
  hint: { color: colors.text },
  error: { color: colors.text },
});
