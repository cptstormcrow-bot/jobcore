// JobCore screen #0025 - ft-DayList - Jobs
/**
 * DayList screen for the field-tech module (P4.S3.2).
 *
 * Renders the signed-in tech's jobs for the day. Scoping is PURELY via
 * Supabase RLS — this screen does NOT add any client-side role/tech filter
 * on top of the query. `TechJobRepository.listAssignedToTech` is called
 * with the session's own `userId`; RLS on the `jobs`/`job_assignments`
 * tables (see `0007_field_tech_tables.sql` comments referenced in
 * `data/ports.ts`) is what actually restricts the result set to jobs
 * assigned to this tech. Ties to spec AC1, VS1.
 *
 * Mirrors `modules/admin-finance/src` layering: screen reads session +
 * ports via the module seams, never constructs a repository itself.
 *
 * The screen shows an "Assigned Jobs" list (every open job, earliest first,
 * customer first), then one row above the calendar holding the Week/Month tabs and
 * the `<  Today  >` controls. The center label shows the anchor day; tapping
 * a day moves the anchor there, and tapping the label returns to today. The
 * calendar is fed the assigned-jobs list
 * plus this tech's own active time-off requests, expanded day-by-day into
 * `TimeOffEvent`s the same way `AdminFinanceRoot.toCalendarTimeOffEvents`
 * does for the admin calendar), and a "Previous Jobs" list of the last 10
 * completed jobs.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReadCacheRevision } from '../lib/read-cache';
import { View, FlatList, ActivityIndicator, Pressable, StyleSheet, ScrollView, Modal } from 'react-native';
import type { Job } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { addDays, addMonths, format, isSameDay } from 'date-fns';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { JOB_STATUS_COLORS, JOB_STATUS_GLYPHS, ScreenTitle, WeekView, MonthView, DefaultTabBar, PayrollButton, colors, typography, spacing, compact, radius, type TimeOffEvent, Text, TruncatedText } from '@jobcore/ui';
import type { TimeOffRequest } from '../data/ports';
import { copyToClipboard } from '../lib/clipboard';
import { isScheduledOnLocalDate, expandTimeOffToEvents, listAssignedJobs, listPreviousJobs } from './day-list-helpers';

/** Props for `DayList`. */
export interface DayListProps {
  /**
   * Optional row-selection callback. When provided, each job row becomes
   * pressable and invokes this with the tapped job. When omitted, rows
   * remain non-interactive — no behavior change for existing callers.
   */
  onSelectJob?: (job: Job) => void;
  /** Opens the given job (today list + week strip job cards). */
  onOpenJob?: (jobId: string) => void;
  /** Opens the given time-off entry (week strip time-off cards). */
  onOpenTimeOff?: (event: TimeOffEvent) => void;
  /**
   * Optional tech id override — when provided (admin viewing a specific
   * tech), scopes the fetch to this tech instead of the signed-in
   * session's own userId.
   */
  techId?: string;
  showTestJobs?: boolean;
  defaultViewMode?: 'week' | 'month';
}

export { isScheduledOnLocalDate, expandTimeOffToEvents } from './day-list-helpers';

export function DayList({ onSelectJob, onOpenJob, onOpenTimeOff, techId, showTestJobs, defaultViewMode }: DayListProps = {}): React.ReactElement {
  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = useRef(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorDay, setAnchorDay] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>(defaultViewMode ?? 'week');
  useEffect(() => {
    if (defaultViewMode) setViewMode(defaultViewMode);
  }, [defaultViewMode]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [fullTextJobId, setFullTextJobId] = useState<string | null>(null);
  const visibleJobs = useMemo(() => jobs.filter((job) => isBetaVisible(job, showTestJobs ?? false)), [jobs, showTestJobs]);
  const assignedJobs = useMemo(() => listAssignedJobs(visibleJobs), [visibleJobs]);
  const previousJobs = useMemo(() => listPreviousJobs(visibleJobs, 10), [visibleJobs]);
  const timeOffEvents = useMemo(() => expandTimeOffToEvents(timeOffRequests), [timeOffRequests]);

  useEffect(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    if (!hasLoadedRef.current) setLoading(true);
    hasLoadedRef.current = true;
    setError(null);

    const { jobs: jobsRepository, timeOff: timeOffRepository } = getModulePorts();

    Promise.all([jobsRepository.listAssignedToTech(techId ?? session.userId), timeOffRepository.listForTech(techId ?? session.userId)])
      .then(([jobsResult, timeOffResult]: [Job[], TimeOffRequest[]]) => {
        if (!cancelled) {
          setJobs(jobsResult);
          setTimeOffRequests(timeOffResult);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load jobs.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, techId, rev]);

  if (session === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Sign in to see your jobs.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const handleOpenJob = (job: Job) => {
    onSelectJob?.(job);
    onOpenJob?.(job.id);
  };

  const handleSelectDay = (day: Date) => {
    setAnchorDay(day);
    setSelectedDay(day);
  };

  // Address • phone • date on one line; TruncatedText opens the full line in a popup when cut off.
  const assignedJobLine = (job: Job) =>
    [
      job.address ?? 'No address',
      job.customerPhone,
      job.requestedWindow ?? (job.scheduledStart ? format(new Date(job.scheduledStart), 'EEE M/d h:mm a') : 'Unscheduled'),
    ]
      .filter(Boolean)
      .join('  •  ');

  const renderJobRow = (job: Job) => (
    <Pressable key={job.id} onPress={() => handleOpenJob(job)}>
      <View style={styles.row}>
        <Text style={styles.bullet}>{'•'}</Text>
        <View style={[styles.statusChip, { backgroundColor: JOB_STATUS_COLORS[job.status] }]} />
        <Text style={styles.statusGlyph}>{JOB_STATUS_GLYPHS[job.status]}</Text>
        <View style={styles.rowBody}>
          <TruncatedText style={styles.customer} popupTitle="Customer">{job.customerName ?? 'No customer'}</TruncatedText>
          <TruncatedText style={styles.meta} popupTitle={job.customerName ?? 'Job'}>
            {assignedJobLine(job)}
          </TruncatedText>
        </View>
      </View>
    </Pressable>
  );

  const step = (dir: 1 | -1) =>
    setAnchorDay((d) => (viewMode === 'week' ? addDays(d, 7 * dir) : addMonths(d, dir)));
  const anchorLabel = isSameDay(anchorDay, new Date())
    ? 'Today'
    : viewMode === 'week'
      ? format(anchorDay, 'EEE, MMM d')
      : format(anchorDay, 'MMMM yyyy');

  const calendarNav = (
    <View style={styles.calendarNav}>
      <PayrollButton label="<" accessibilityLabel={viewMode === 'week' ? 'Previous week' : 'Previous month'} onPress={() => step(-1)} />
      <PayrollButton label={anchorLabel} accessibilityLabel="Go to today" style={styles.navCenter} onPress={() => setAnchorDay(new Date())} />
      <PayrollButton label=">" accessibilityLabel={viewMode === 'week' ? 'Next week' : 'Next month'} onPress={() => step(1)} />
    </View>
  );

  return (
    <View style={styles.screen}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.listContent}>
      <ScreenTitle title="Assigned Jobs" />
      {assignedJobs.length === 0 ? (
        <Text style={styles.emptyText}>No assigned jobs.</Text>
      ) : (
        assignedJobs.map(renderJobRow)
      )}

      <View style={styles.calendarHeader}>
        <DefaultTabBar
          tabs={[
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
          ]}
          activeId={viewMode}
          onChange={(k) => setViewMode(k as 'week' | 'month')}
        />
        {calendarNav}
      </View>
      {viewMode === 'week' ? (
        <View style={styles.weekStrip}>
          <WeekView
            jobs={visibleJobs}
            anchorDay={anchorDay}
            timeOffEvents={timeOffEvents}
            onSelectJob={(job) => handleOpenJob(job)}
            onSelectTimeOff={onOpenTimeOff}
            onSelectDay={handleSelectDay}
          />
        </View>
      ) : (
        <View style={styles.monthStrip}>
          <MonthView
            jobs={visibleJobs}
            anchorDay={anchorDay}
            timeOffEvents={timeOffEvents}
            onSelectDay={(day) => {
              handleSelectDay(day);
            }}
          />
        </View>
      )}
      <Modal
        visible={selectedDay !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDay(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setSelectedDay(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView>
              {selectedDay !== null ? (
                <>
                  <Text style={styles.modalTitle}>{format(selectedDay, 'EEEE, MMM d')}</Text>
                  {visibleJobs
                    .filter((job) => job.scheduledStart !== null && job.scheduledStart !== undefined && isSameDay(new Date(job.scheduledStart), selectedDay))
                    .sort((a, b) => new Date(a.scheduledStart as string).getTime() - new Date(b.scheduledStart as string).getTime())
                    .map((job) => (
                      <View key={job.id} style={styles.modalJobRow}>
                        <Pressable onPress={() => job.address && copyToClipboard(job.address)}>
                          <Text style={styles.address}>{job.address ?? 'No address'}</Text>
                        </Pressable>
                        {job.customerName ? <Text style={styles.meta}>{job.customerName}</Text> : null}
                        {job.customerPhone ? (
                          <Pressable onPress={() => copyToClipboard(job.customerPhone ?? '')}>
                            <Text style={styles.meta}>{job.customerPhone}</Text>
                          </Pressable>
                        ) : null}
                        <Text style={styles.window}>{job.requestedWindow ?? job.scheduledStart ?? 'Unscheduled'}</Text>
                      </View>
                    ))}
                  {timeOffEvents
                    .filter((event) => isSameDay(new Date(event.eventTime), selectedDay))
                    .map((event) => (
                      <View key={event.id} style={styles.modalTimeOffRow}>
                        <Text style={styles.modalTimeOffText}>{event.description ?? 'Day off'}</Text>
                      </View>
                    ))}
                  <PayrollButton label="Close" style={styles.modalCloseButton} onPress={() => setSelectedDay(null)} />
                </>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <ScreenTitle title="Previous Jobs" />
      {previousJobs.length === 0 ? (
        <Text style={styles.emptyText}>No completed jobs yet.</Text>
      ) : (
        previousJobs.map((job) => (
          <Pressable key={job.id} style={styles.previousRow} onPress={() => handleOpenJob(job)} onLongPress={() => setFullTextJobId(job.id)}>
            <TruncatedText
              style={styles.previousText}
              tappable={false}
              open={fullTextJobId === job.id}
              onClose={() => setFullTextJobId(null)}
            >
              {(job.address ?? 'No address') + ' - ' + new Date((job.completedAt ?? job.scheduledStart) as string).toLocaleDateString()}
            </TruncatedText>
          </Pressable>
        ))
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: typography.text.body,
    color: colors.textMutedDark,
  },
  errorText: {
    fontSize: typography.text.error,
    color: colors.danger,
  },
  listContent: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: compact.rowMin,
    paddingVertical: compact.field,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bullet: {
    marginRight: spacing.sm,
    color: colors.textMuted,
  },
  statusChip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.xs,
  },
  statusGlyph: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.sm,
  },
  rowBody: {
    flex: 1,
  },
  customer: {
    fontSize: typography.text.input,
    fontWeight: '600',
    color: colors.text,
  },
  address: {
    fontSize: typography.text.body,
    fontWeight: '600',
  },
  window: {
    fontSize: typography.text.hint,
    color: colors.textMutedDark,
    marginTop: compact.gap,
  },
  meta: {
    fontSize: typography.text.body,
    color: colors.textMuted,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact.section,
    marginTop: compact.section,
  },
  calendarNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: compact.section,
  },
  navCenter: {
    flex: 1,
  },
  weekStrip: {
    height: 260,
    marginTop: compact.section,
  },
  monthStrip: {
    marginTop: compact.section,
  },
  previousRow: {
    minHeight: compact.rowMin,
    justifyContent: 'center',
    paddingVertical: compact.field,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  previousText: {
    fontSize: typography.text.body,
    color: colors.textMutedDark,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.text.title,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  modalJobRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTimeOffRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTimeOffText: {
    fontSize: typography.text.body,
    color: colors.danger,
  },
  modalCloseButton: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
  },
});
