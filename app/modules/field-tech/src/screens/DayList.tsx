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
 * Also renders a "This Week" strip below the today list — a `WeekView`
 * (from `@jobcore/ui`) fed the same assigned-jobs list plus this tech's
 * own active time-off requests, expanded day-by-day into `TimeOffEvent`s
 * the same way `AdminFinanceRoot.toCalendarTimeOffEvents` does for the
 * admin calendar.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, ScrollView, Modal } from 'react-native';
import type { Job } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { addDays, addMonths, format, isSameDay } from 'date-fns';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { JOB_STATUS_COLORS, ScreenTitle, WeekView, MonthView, TabBar, colors, typography, spacing, radius, type TimeOffEvent } from '@jobcore/ui';
import { isActiveTimeOffStatus, type TimeOffRequest } from '../data/ports';
import { copyToClipboard } from '../lib/clipboard';

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

/**
 * True when `job.scheduledStart` falls on the same LOCAL calendar date as
 * `today`. A job with no `scheduledStart` is never "today".
 */
export function isScheduledOnLocalDate(job: Job, today: Date): boolean {
  if (job.scheduledStart === null || job.scheduledStart === undefined) {
    return false;
  }
  const scheduled = new Date(job.scheduledStart);
  if (Number.isNaN(scheduled.getTime())) {
    return false;
  }
  return isSameDay(scheduled, today);
}

/**
 * Expands each active (`pending` | `approved`) `TimeOffRequest` — spanning a
 * `startDate`/`endDate` range — into one `TimeOffEvent` per calendar day in
 * range. Mirrors `AdminFinanceRoot.toCalendarTimeOffEvents`, minus the
 * admin-only tech-name lookup (this list is always the signed-in tech's own
 * requests).
 */
export function expandTimeOffToEvents(requests: TimeOffRequest[], now: Date = new Date()): TimeOffEvent[] {
  const events: TimeOffEvent[] = [];
  for (const request of requests) {
    if (!isActiveTimeOffStatus(request.status)) continue;
    const start = parseCalendarDate(request.startDate);
    const end = parseCalendarDate(request.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }
    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      events.push({
        id: `${request.id}-${cursor.toISOString().slice(0, 10)}`,
        title: 'Day Off',
        description: request.reason,
        eventTime: cursor.toISOString(),
        techId: request.techId,
      });
      cursor = addDays(cursor, 1);
    }
  }
  return events;
}

function parseCalendarDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return new Date(NaN);
  }
  return new Date(year, month - 1, day);
}

export function DayList({ onSelectJob, onOpenJob, onOpenTimeOff, techId, showTestJobs, defaultViewMode }: DayListProps = {}): React.ReactElement {
  const session = getModuleSession();
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
  const visibleJobs = jobs.filter((job) => isBetaVisible(job, showTestJobs ?? false));
  const todayJobs = useMemo(() => {
    const today = new Date();
    return visibleJobs
      .filter((job) => isScheduledOnLocalDate(job, today))
      .sort((a, b) => new Date(a.scheduledStart as string).getTime() - new Date(b.scheduledStart as string).getTime());
  }, [visibleJobs]);
  const timeOffEvents = useMemo(() => expandTimeOffToEvents(timeOffRequests), [timeOffRequests]);

  useEffect(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
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
  }, [session, techId]);

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

  const weekLabel =
    viewMode === 'week' ? format(anchorDay, 'MMM d, yyyy') : format(anchorDay, 'MMMM yyyy');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.listContent}>
      <ScreenTitle title="Today's Jobs" />
      {todayJobs.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No jobs scheduled today.</Text>
        </View>
      ) : (
        <FlatList
          data={todayJobs}
          keyExtractor={(job) => job.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const rowContent = (
              <View style={styles.row}>
                <Text style={styles.bullet}>{'\u2022'}</Text>
                <View style={[styles.statusChip, { backgroundColor: JOB_STATUS_COLORS[item.status] }]} />
                <View style={styles.rowBody}>
                  <Pressable onPress={() => item.address && copyToClipboard(item.address)}>
                    <Text style={styles.address}>{item.address ?? 'No address'}</Text>
                  </Pressable>
                  {item.customerName ? <Text style={styles.meta}>{item.customerName}</Text> : null}
                  {item.customerPhone ? (
                    <Pressable onPress={() => copyToClipboard(item.customerPhone ?? '')}>
                      <Text style={styles.meta}>{item.customerPhone}</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.window}>{item.requestedWindow ?? item.scheduledStart ?? 'Unscheduled'}</Text>
                </View>
              </View>
            );

            return <Pressable onPress={() => handleOpenJob(item)}>{rowContent}</Pressable>;
          }}
        />
      )}

      <View style={styles.weekHeader}>
        <ScreenTitle title={viewMode === 'week' ? 'This Week' : 'This Month'} />
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
        <Text style={styles.weekLabel}>{weekLabel}</Text>
      </View>
      <TabBar
        items={[
          { key: 'week', label: 'Week' },
          { key: 'month', label: 'Month' },
        ]}
        activeKey={viewMode}
        onSelect={(k) => setViewMode(k as 'week' | 'month')}
        style={styles.modeToggle}
      />
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
                  <Pressable style={styles.modalCloseButton} onPress={() => setSelectedDay(null)}>
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
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
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
  },
  address: {
    fontSize: 16,
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
    backgroundColor: colors.surfaceAlt,
  },
  navButtonText: {
    fontSize: typography.size.label,
    color: colors.primary,
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
  modeToggle: {
    marginTop: spacing.sm,
    paddingHorizontal: 0,
  },
  monthStrip: {
    marginTop: spacing.sm,
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  modalCloseButtonText: {
    fontSize: typography.size.label,
    color: colors.primary,
    fontWeight: '600',
  },
});
