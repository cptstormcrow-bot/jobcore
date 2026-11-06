// JobCore shared Universal Calendar (admin + tech) - month/week/day with blackout day-picking and time-off requests (replaces #0031).
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { addDays, addMonths, addWeeks, subMonths, subWeeks, format, isSameDay, startOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { DayActionSheet, TimePicker, PayrollButton, ScheduleItemPopup, formatSlotHeading, SAND_BG, TechSelect, TextField, WeekView, MonthView, DayView, CalendarHeader, colors, spacing, radius } from '@jobcore/ui';
import type { TimeOffEvent, CalendarMode, ScheduleItemDetail } from '@jobcore/ui';
import { blackoutScheduleDetail, jobScheduleDetail } from '../domain/schedule-items';
import type { Job } from '@jobcore/core';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';
import { togglePickedDay } from './blackout-calendar-logic';

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

export interface UniversalCalendarTimeOffDraft {
  startDate: string;
  endDate: string;
  reason: string | null;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeOffRange(start: string, end: string): boolean {
  if (!DATE_KEY.test(start) || !DATE_KEY.test(end)) return false;
  const s = parseCalendarDate(start);
  const e = parseCalendarDate(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  return end >= start;
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
  /** Host hook: when set, a month/week day tap (outside blackout pick mode) calls this instead of drilling into Day view. */
  onPickDay?: (day: Date) => void;
  onSubmitTimeOff?: (draft: UniversalCalendarTimeOffDraft, techId: string) => Promise<void> | void;
  onCancelTimeOff?: (requestId: string) => Promise<void> | void;
  /** Admin hook: when set, an "Add Time-off" button opens the host's blackout editor for the filtered tech. */
  onAddBlackout?: (techId: string | null, day?: Date) => void;
  /** Host hook: when set, the day sheet shows Add Job; receives the tapped day and the filtered tech. */
  onAddJob?: (day: Date, techId: string | null, time?: string | null) => void;
  /** Admin: jobs with an approved estimate and an assigned tech that have no slot yet. Listed on the day sheet. */
  schedulableJobs?: Job[];
  /** Admin: Confirm on the day sheet with a picked job and time schedules that job. Throws on failure. */
  onScheduleJob?: (job: Job, day: Date, time: string) => Promise<void>;
  /** Admin: Move on the day sheet reschedules a job already on that day to the picked time. Throws on failure. */
  onRescheduleJob?: (job: Job, day: Date, time: string) => Promise<void>;
  /** Admin: Remove from schedule on the day sheet clears a job's slot. Throws on failure. */
  onClearJob?: (job: Job) => Promise<void>;
  /** Rendered directly above the day timeline in Day mode only; receives the anchored day. */
  renderDayActions?: (day: Date) => ReactNode;
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
  const [requesting, setRequesting] = useState(false);
  const [reqStart, setReqStart] = useState('');
  const [reqEnd, setReqEnd] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqSaving, setReqSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [sheetDay, setSheetDay] = useState<Date | null>(null);
  const [pickTime, setPickTime] = useState<string | null>(null);
  const [showBlackouts, setShowBlackouts] = useState(true);
  const [popupDetail, setPopupDetail] = useState<ScheduleItemDetail | null>(null);

  const effectiveTechId = role === 'tech' ? viewerId : techFilter;
  const techs = employees.filter((e) => e.role === 'tech' && e.active);
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current) return;
    if (role !== 'tech' && !defaultFilters?.techId && viewerId && techs.some((t) => t.id === viewerId)) {
      autoPicked.current = true;
      setTechFilter(viewerId);
    }
  });
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

  // #0058-style Show/Hide Time-off: hides time-off from the grids only; the day sheet still lists them.
  const shownTimeOff = showBlackouts ? timeOffEvents : [];

  function handleJobInfo(job: Job): void {
    if (!job.scheduledStart) return;
    const whenLabel = formatSlotHeading(job.scheduledStart, job.scheduledEnd ?? null);
    const tech = job.assignedTechId ? techNameById.get(job.assignedTechId) : undefined;
    const detail = jobScheduleDetail(job, whenLabel);
    setPopupDetail(tech ? { ...detail, title: `${detail.title} (${tech})` } : detail);
  }

  function handleBlackoutInfo(b: { id: string }): void {
    const request = timeOffRequests.find((r) => b.id.startsWith(`${r.id}-`));
    if (!request) return;
    const whenLabel =
      request.startDate === request.endDate ? request.startDate : `${request.startDate} to ${request.endDate}`;
    setPopupDetail(blackoutScheduleDetail(request, techNameById.get(request.techId), whenLabel));
  }

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
    setPicked((prev) => togglePickedDay(prev, isoDay));
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
      setError(e instanceof Error ? e.message : 'Could not save time-off');
    } finally {
      setSaving(false);
    }
  }

  function handleTogglePick(): void {
    if (pickDays) setPicked([]);
    setError(null);
    if (!pickDays && requesting) {
      setRequesting(false);
      setReqStart('');
      setReqEnd('');
      setReqReason('');
    }
    setPickDays((v) => !v);
  }

  function handleToggleRequest(): void {
    setError(null);
    if (requesting) {
      setReqStart('');
      setReqEnd('');
      setReqReason('');
    } else {
      setPickDays(false);
      setPicked([]);
    }
    setRequesting((v) => !v);
  }

  function fillRequestDay(isoDay: string): void {
    if (!reqStart || reqEnd) {
      setReqStart(isoDay);
      setReqEnd('');
    } else {
      setReqEnd(isoDay);
    }
  }

  function handleDayPress(isoDay: string): void {
    if (pickDays) toggle(isoDay);
    else fillRequestDay(isoDay);
  }

  async function handleSubmitRequest(): Promise<void> {
    if (!props.onSubmitTimeOff || !effectiveTechId || !isValidTimeOffRange(reqStart, reqEnd)) return;
    setReqSaving(true);
    setError(null);
    try {
      await props.onSubmitTimeOff({ startDate: reqStart, endDate: reqEnd, reason: reqReason.trim() || null }, effectiveTechId);
      setReqStart('');
      setReqEnd('');
      setReqReason('');
      setRequesting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit time-off request');
    } finally {
      setReqSaving(false);
    }
  }

  async function handleCancelRequest(id: string): Promise<void> {
    if (!props.onCancelTimeOff) return;
    setCancellingId(id);
    setError(null);
    try {
      await props.onCancelTimeOff(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel time-off request');
    } finally {
      setCancellingId(null);
    }
  }

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const upcomingOwn =
    props.onCancelTimeOff && effectiveTechId
      ? timeOffRequests
          .filter(
            (r) =>
              r.techId === effectiveTechId && (r.status === 'pending' || r.status === 'approved') && r.endDate >= todayKey,
          )
          .slice(0, 3)
      : [];
  const dayPickActive = pickDays || requesting;

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
      <View style={styles.actionRow}>
        {role === 'admin' ? (
          <TechSelect
            label="Technician"
            value={techFilter}
            onChange={(v) => setTechFilter(v === '' ? null : v)}
            placeholder="All Techs"
            options={[{ label: 'All Techs', value: '' }, ...techs.map((t) => ({ label: t.fullName, value: t.id }))]}
            style={styles.techSelect}
          />
        ) : null}
        {role === 'tech' ? (
          <TechSelect
            label="Technician"
            value={viewerId}
            onChange={() => {}}
            options={techs.filter((t) => t.id === viewerId).map((t) => ({ label: t.fullName, value: t.id }))}
            style={styles.techSelect}
          />
        ) : null}
        <View testID="calendar-blackouts-toggle">
          <PayrollButton label={pickDays ? 'Cancel' : 'Time-off'} onPress={handleTogglePick} />
        </View>
        <View testID="calendar-blackouts-visibility">
          <PayrollButton
            label={showBlackouts ? 'Hide Time-off' : 'Show Time-off'}
            onPress={() => setShowBlackouts((v) => !v)}
          />
        </View>
        {props.onSubmitTimeOff ? (
          <View testID="calendar-timeoff-toggle">
            <PayrollButton label={requesting ? 'Cancel' : 'Request time off'} onPress={handleToggleRequest} />
          </View>
        ) : null}
        {props.onAddBlackout && !dayPickActive ? (
          <View testID="calendar-add-blackout">
            <PayrollButton label="Add Time-off" onPress={() => props.onAddBlackout?.(effectiveTechId)} />
          </View>
        ) : null}
        <View testID="calendar-hour-picker" style={styles.hourPicker}>
          <TimePicker value={pickTime} onChange={setPickTime} />
        </View>
      </View>
      {pickDays ? (
        <View style={styles.pickBar}>
          <Text style={styles.pickText}>Tap days to black out</Text>
          {role === 'admin' && !effectiveTechId ? <Text style={styles.hint}>Pick a technician first</Text> : null}
          <View testID="calendar-blackouts-save">
            <PayrollButton
              label={`Save ${picked.length} day(s)`}
              disabled={picked.length === 0 || saving || !effectiveTechId}
              onPress={() => {
                void handleSave();
              }}
            />
          </View>
        </View>
      ) : null}
      {requesting && props.onSubmitTimeOff ? (
        <View testID="calendar-timeoff-panel" style={styles.requestPanel}>
          {role === 'admin' && !effectiveTechId ? <Text style={styles.hint}>Pick a technician first</Text> : null}
          <View testID="calendar-timeoff-start" style={styles.field}>
            <TextField inline dense label="Start date (YYYY-MM-DD)" labelStyle={styles.fieldLabel} value={reqStart} onChangeText={setReqStart} placeholder="YYYY-MM-DD" />
          </View>
          <View testID="calendar-timeoff-end" style={styles.field}>
            <TextField inline dense label="End date (YYYY-MM-DD)" labelStyle={styles.fieldLabel} value={reqEnd} onChangeText={setReqEnd} placeholder="YYYY-MM-DD" />
          </View>
          <View testID="calendar-timeoff-reason" style={styles.field}>
            <TextField inline dense label="Reason (optional)" labelStyle={styles.fieldLabel} value={reqReason} onChangeText={setReqReason} />
          </View>
          <View testID="calendar-timeoff-submit">
            <PayrollButton
              label="Submit request"
              disabled={!isValidTimeOffRange(reqStart, reqEnd) || !effectiveTechId || reqSaving}
              onPress={() => {
                void handleSubmitRequest();
              }}
            />
          </View>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!dayPickActive && upcomingOwn.length > 0 ? (
        <View style={styles.upcomingList}>
          <Text style={styles.fieldLabel}>Upcoming time off</Text>
          {upcomingOwn.map((r) => (
            <View key={r.id} style={styles.upcomingRow}>
              <Text style={styles.pickText}>
                {`${format(parseCalendarDate(r.startDate), 'MMM d')} – ${format(parseCalendarDate(r.endDate), 'MMM d')}`}
              </Text>
              <View testID={`calendar-timeoff-cancel-${r.id}`}>
                <PayrollButton
                  label="Cancel"
                  disabled={cancellingId === r.id}
                  onPress={() => {
                    void handleCancelRequest(r.id);
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <CalendarHeader
        mode={mode}
        onModeChange={setMode}
        label={label}
        labelPosition="above"
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />
      {mode === 'month' ? (
        <MonthView
          variant="tiles"
          highlightTechId={effectiveTechId ?? undefined}
          jobs={calendarJobs}
          anchorDay={anchor}
          timeOffEvents={shownTimeOff}
          selectedDays={pickDays ? picked : [reqStart, reqEnd].filter((d) => d !== '')}
          onDayPress={dayPickActive ? handleDayPress : undefined}
          onSelectDay={(d) => {
            setAnchor(d);
            if (props.onPickDay) {
              props.onPickDay(d);
              return;
            }
            setSheetDay(d); // #0025-style day sheet: add a job or blackout, open details
          }}
          onSelectJob={onSelectJob}
        />
      ) : mode === 'week' ? (
        <WeekView
          jobs={calendarJobs}
          anchorDay={anchor}
          timeOffEvents={shownTimeOff}
          onSelectJob={onSelectJob}
          onDayPress={
            dayPickActive
              ? (d) => handleDayPress(format(d, 'yyyy-MM-dd'))
              : (d) => {
                  setAnchor(d);
                  if (props.onPickDay) props.onPickDay(d);
                  else setSheetDay(d);
                }
          }
        />
      ) : (
        <>
          {props.renderDayActions?.(anchor)}
          <DayView date={anchor} jobs={calendarJobs} timeOff={shownTimeOff} onJobPress={onSelectJob} />
        </>
      )}
      <DayActionSheet
        day={sheetDay}
        time={pickTime}
        jobs={sheetDay ? calendarJobs.filter((j) => j.scheduledStart && isSameDay(new Date(j.scheduledStart), sheetDay)) : []}
        blackouts={sheetDay ? timeOffEvents.filter((e) => isSameDay(new Date(e.eventTime), sheetDay)) : []}
        onClose={() => setSheetDay(null)}
        schedulableJobs={(props.schedulableJobs ?? []).filter((j) => !effectiveTechId || j.assignedTechId === effectiveTechId)}
        {...(props.onScheduleJob ? { onConfirmSchedule: props.onScheduleJob } : {})}
        {...(props.onRescheduleJob ? { onRescheduleJob: props.onRescheduleJob } : {})}
        {...(props.onClearJob ? { onClearJob: props.onClearJob } : {})}
        onJobInfo={handleJobInfo}
        onBlackoutInfo={handleBlackoutInfo}
        onAddJob={props.onAddJob ? (d, time) => { setSheetDay(null); props.onAddJob?.(d, effectiveTechId, time); } : undefined}
        onAddBlackout={(d) => {
          setSheetDay(null);
          if (props.onAddBlackout) { props.onAddBlackout(effectiveTechId, d); return; }
          // No blackout editor on this host: start the in-calendar day picking with this day preselected.
          setRequesting(false);
          setError(null);
          setPickDays(true);
          setPicked([format(d, 'yyyy-MM-dd')]);
        }}
        onOpenJob={(job) => { setSheetDay(null); onSelectJob(job); }}
        onOpenBlackout={props.onAddBlackout ? (b) => {
          const day = sheetDay;
          setSheetDay(null);
          const ev = timeOffEvents.find((e) => e.id === b.id);
          props.onAddBlackout?.(ev?.techId ?? effectiveTechId, day ?? undefined);
        } : undefined}
        onOpenDayView={(d) => { setSheetDay(null); setAnchor(d); setMode('day'); }}
      />
      <ScheduleItemPopup
        visible={popupDetail !== null}
        detail={popupDetail}
        onClose={() => setPopupDetail(null)}
        onOpenJob={() => setPopupDetail(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.xs, padding: spacing.xs },
  returnLink: { paddingVertical: spacing.xs },
  returnText: { color: colors.primary },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  techSelect: { minWidth: 240 },
  hourPicker: { flexGrow: 1, flexShrink: 1, minWidth: 260 },
  pickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: SAND_BG,
    borderRadius: radius.md,
  },
  requestPanel: {
    flexDirection: 'column',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: SAND_BG,
    borderRadius: radius.md,
  },
  field: { alignSelf: 'stretch' },
  fieldLabel: { color: colors.text },
  upcomingList: { maxHeight: 130, gap: spacing.xs },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  pickText: { color: colors.text },
  hint: { color: colors.text },
  error: { color: colors.text },
});
