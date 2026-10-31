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
 * The screen shows a "Next Job" card, a Week/Month calendar with
 * Prev/Today/Next controls on the toggle row (fed the assigned-jobs list
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
import { JOB_STATUS_COLORS, JOB_STATUS_GLYPHS, ScreenTitle, WeekView, MonthView, DefaultTabBar, PayrollButton, colors, typography, spacing, radius, type TimeOffEvent, Text } from '@jobcore/ui';
import type { TimeOffRequest } from '../data/ports';
import { copyToClipboard } from '../lib/clipboard';
import { isScheduledOnLocalDate, expandTimeOffToEvents, pickNextJob, listPreviousJobs } from './day-list-helpers';

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
  const visibleJobs = useMemo(() => jobs.filter((job) => isBetaVisible(job, showTestJobs ?? false)), [jobs, showTestJobs]);
  const nextJob = useMemo(() => pickNextJob(visibleJobs, new Date()), [visibleJobs]);
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

  const handleSelectDay = (day: Date) => setSelectedDay(day);

  const renderJobRow = (job: Job) => (
    <Pressable key={job.id} onPress={() => handleOpenJob(job)}>
      <View style={styles.row}>
        <Text style={styles.bullet}>{'•'}</Text>
        <View style={[styles.statusChip, { backgroundColor: JOB_STATUS_COLORS[job.status] }]} />
        <Text style={styles.statusGlyph}>{JOB_STATUS_GLYPHS[job.status]}</Text>
        <View style={styles.rowBody}>
          <Pressable onPress={() => job.address && copyToClipboard(job.address)}>
            <Text style={styles.address}>{job.address ?? 'No address'}</Text>
          </Pressable>
          {job.customerName ? <Text style={styles.meta}>{job.customerName}</Text> : null}
          {job.customerPhone ? (
            <Pressable onPress={() => copyToClipboard(job.customerPhone ?? '')}>
              <Text style={styles.meta}>{job.customerPhone}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.window}>
            {job.requestedWindow ?? (job.scheduledStart ? new Date(job.scheduledStart).toLocaleString() : 'Unscheduled')}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  const weekLabel =
    viewMode === 'week' ? format(anchorDay, 'MMM d, yyyy') : format(anchorDay, 'MMMM yyyy');

  const weekNav = (
    <View style={styles.weekNav}>
      <Pressable
        style={styles.navButton}
        onPress={() =>
          setAnchorDay((d) => (viewMode === 'week' ? addDays(d, -7) : addMonths(d, -1)))
        }
      >
        <Text style={styles.navButtonText}>Prev</Text>
      </Pressable>
      <Pressable style={styles.navButton} onPress={() => setAnchorDay(new Date())}>
        <Text style={styles.navButtonText}>Today</Text>
      </Pressable>
      <Pressable
        style={styles.navButton}
        onPress={() =>
          setAnchorDay((d) => (viewMode === 'week' ? addDays(d, 7) : addMonths(d, 1)))
        }
      >
        <Text style={styles.navButtonText}>Next</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
    <DefaultTabBar
      tabs={[
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
      ]}
      activeId={viewMode}
      onChange={(k) => setViewMode(k as 'week' | 'month')}
      rightSlot={weekNav}
    />
    <ScrollView style={styles.screen} contentContainerStyle={styles.listContent}>
      <ScreenTitle title="Next Job" />
      {nextJob === undefined ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No upcoming jobs.</Text>
        </View>
      ) : (
        renderJobRow(nextJob)
      )}

      <View style={styles.weekHeader}>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
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
          <Pressable key={job.id} style={styles.previousRow} onPress={() => handleOpenJob(job)}>
            <Text style={styles.previousText} numberOfLines={1}>
              {(job.address ?? 'No address') + ' - ' + new Date((job.completedAt ?? job.scheduledStart) as string).toLocaleDateString()}
            </Text>
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
    padding: 16,
  },
  emptyText: {
    color: colors.textMutedDark,
  },
  errorText: {
    color: colors.danger,
  },
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bullet: {
    marginRight: 8,
    color: colors.textMuted,
  },
  statusChip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  statusGlyph: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginRight: 8,
  },
  rowBody: {
    flex: 1,
  },
  address: {
    fontSize: typography.size.label,
    fontWeight: '600',
  },
  window: {
    fontSize: 13,
    color: colors.textMutedDark,
    marginTop: 2,
  },
  meta: {
    fontSize: typography.size.label,
    color: colors.textMuted,
  },
  weekHeader: {
    marginTop: spacing.lg,
  },
  weekNav: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  navButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.sm,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
  navButtonText: {
    fontSize: typography.size.label,
    color: colors.text,
    fontWeight: '600',
  },
  weekLabel: {
    marginTop: spacing.sm,
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  weekStrip: {
    height: 260,
    marginTop: spacing.sm,
  },
  monthStrip: {
    marginTop: spacing.sm,
  },
  previousRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  previousText: {
    fontSize: typography.size.label,
    color: colors.textMutedDark,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalJobRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTimeOffRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTimeOffText: {
    fontSize: 14,
    color: colors.danger,
  },
  modalCloseButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
});
