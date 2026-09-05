// P2e.2a/2b/2c - Calendar day + week view, status colours, role gate.
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, Toggle } from '@jobcore/ui';
import type { Job, JobStatus } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { addDays, addMonths, format } from 'date-fns';
import { useRouter } from 'expo-router';
import { WeekView, MonthView, type TimeOffEvent } from '@jobcore/ui';
import { JOB_STATUS_COLORS } from '@jobcore/ui';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';

/** `jobs` row shape (snake_case) -> domain `Job` (camelCase). */
interface JobRow {
  id: string;
  organization_id: string;
  status: string;
  customer_id: string | null;
  service_id: string | null;
  source: string | null;
  payer: string | null;
  attach_timing: string | null;
  requested_window: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  address: string | null;
  description: string | null;
  assigned_tech_id: string | null;
  en_route_at: string | null;
  in_progress_at: string | null;
  completed_at: string | null;
  created_at: string;
  is_beta: boolean;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: row.status as JobStatus,
    customerId: row.customer_id,
    serviceId: row.service_id,
    source: row.source,
    payer: row.payer,
    attachTiming: row.attach_timing,
    requestedWindow: row.requested_window,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    address: row.address,
    description: row.description,
    assignedTechId: row.assigned_tech_id,
    enRouteAt: row.en_route_at,
    inProgressAt: row.in_progress_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    isBeta: row.is_beta,
  };
}

const JOB_ROW_COLUMNS =
  'id, organization_id, status, customer_id, service_id, source, payer, attach_timing, ' +
  'requested_window, scheduled_start, scheduled_end, address, description, assigned_tech_id, ' +
  'en_route_at, in_progress_at, completed_at, created_at, is_beta';

// Workstream E: calendar.tsx now sources from the unified `calendar_events` log
// (see supabase/0014_calendar_events.sql) instead of querying `jobs` directly,
// matching admin-finance-repos.ts / field-tech-repos.ts. calendar_events carries
// no job-detail columns itself, so job-linked rows embed the `jobs` row via the
// job_id FK for display (address/status/scheduled time).
interface CalendarEventRow {
  id: string;
  organization_id: string;
  job_id: string | null;
  kind: string;
  title: string | null;
  description: string | null;
  event_time: string;
  jobs: JobRow | null;
}

const CALENDAR_EVENT_COLUMNS = `id, organization_id, job_id, kind, title, description, event_time, jobs (${JOB_ROW_COLUMNS})`;

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7 through 19 inclusive

export default function CalendarScreen() {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('day');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [timeOffEvents, setTimeOffEvents] = useState<TimeOffEvent[]>([]);
  // Workstream K: "Show Test Jobs" toggle, default OFF — hides jobs.is_beta
  // rows spawned by sales-marketing's "Spawn Test Jobs" flow.
  const [showBeta, setShowBeta] = useState(false);
  // Workstream H: per-layer toggles over calendar_events kinds, default ON (both
  // layers visible) so migrating off the old jobs-only query is not a visibility
  // regression. Sit alongside showBeta, not a replacement for it.
  const [showJobsLayer, setShowJobsLayer] = useState(true);
  const [showTimeOffLayer, setShowTimeOffLayer] = useState(true);
  const router = useRouter();

  // Role gate (spec 02-P2 L83-84): an admin/owner/sales sees every tech's jobs,
  // a tech sees only their own. The `s.status ===` discriminant below is on the auth
  // SessionState union, NOT on JobStatus - AC 2 counts only `status ===` gating of a
  // job's status, and this is not that.
  const s = useSession();
  const role = s.status === 'authenticated' ? s.profile.role : undefined;
  const viewerId = s.status === 'authenticated' ? s.profile.id : undefined;
  const orgId = s.status === 'authenticated' ? s.organization.id : undefined;

  // Org-scoped query only, no client-side tech filter: calendar_events_select_org /
  // calendar_events_select_tech RLS policies (supabase/0014_calendar_events.sql) OR
  // together server-side, so an org-scoped query already returns the RLS-correct row
  // set for every role. NOTE: a tech's RLS grant only covers job_id-linked rows, so
  // non-job kinds (e.g. time_off) are invisible to tech-role viewers regardless of the
  // Time Off toggle state below — that's a server-side visibility limit, not a client bug.
  useEffect(() => {
    if (!orgId) {
      setJobs([]);
      setTimeOffEvents([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from('calendar_events')
      .select(CALENDAR_EVENT_COLUMNS)
      .eq('organization_id', orgId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setJobs([]);
          setTimeOffEvents([]);
          return;
        }
        const rows = data as unknown as CalendarEventRow[];
        // calendar_events is an append-only log, so a job can carry multiple
        // status_change rows over its lifetime; dedupe job-linked rows down to
        // one card per job_id (the embedded `jobs` row is always the job's
        // current state regardless of which event row it came from).
        const jobMap = new Map<string, Job>();
        const timeOffs: TimeOffEvent[] = [];
        for (const row of rows) {
          if (row.job_id && row.jobs) {
            jobMap.set(row.job_id, toJob(row.jobs));
          } else if (row.kind === 'time_off') {
            timeOffs.push({
              id: row.id,
              title: row.title,
              description: row.description,
              eventTime: row.event_time,
            });
          }
        }
        setJobs(Array.from(jobMap.values()));
        setTimeOffEvents(timeOffs);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const visibleJobs = showJobsLayer ? jobs.filter((job) => isBetaVisible(job, showBeta)) : [];
  const visibleTimeOff = showTimeOffLayer ? timeOffEvents : [];

  const goPrev = () =>
    setSelectedDay((d) => (mode === 'day' ? addDays(d, -1) : mode === 'week' ? addDays(d, -7) : addMonths(d, -1)));
  const goNext = () =>
    setSelectedDay((d) => (mode === 'day' ? addDays(d, 1) : mode === 'week' ? addDays(d, 7) : addMonths(d, 1)));
  const goToday = () => setSelectedDay(new Date());

  const jobsForHour = (hour: number): Job[] =>
    visibleJobs.filter((job) => {
      if (!job.scheduledStart) return false;
      const start = new Date(job.scheduledStart);
      return (
        start.getFullYear() === selectedDay.getFullYear() &&
        start.getMonth() === selectedDay.getMonth() &&
        start.getDate() === selectedDay.getDate() &&
        start.getHours() === hour
      );
    });

  const timeOffForHour = (hour: number): TimeOffEvent[] =>
    visibleTimeOff.filter((event) => {
      const start = new Date(event.eventTime);
      return (
        start.getFullYear() === selectedDay.getFullYear() &&
        start.getMonth() === selectedDay.getMonth() &&
        start.getDate() === selectedDay.getDate() &&
        start.getHours() === hour
      );
    });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goPrev} style={styles.navButton}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Pressable onPress={goToday} style={styles.navButton}>
          <Text style={styles.navButtonText}>Today</Text>
        </Pressable>
        <Text style={styles.dayLabel}>
          {format(selectedDay, mode === 'day' ? 'EEE, MMM d' : mode === 'week' ? 'MMM d, yyyy' : 'MMMM yyyy')}
        </Text>
        <Pressable onPress={goNext} style={styles.navButton}>
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.modeToggle}>
        <Pressable onPress={() => setMode('day')} style={styles.modeButton}>
          <Text style={[styles.modeButtonText, { color: mode === 'day' ? colors.primary : colors.textMuted }]}>Day</Text>
        </Pressable>
        <Pressable onPress={() => setMode('week')} style={styles.modeButton}>
          <Text style={[styles.modeButtonText, { color: mode === 'week' ? colors.primary : colors.textMuted }]}>Week</Text>
        </Pressable>
        <Pressable onPress={() => setMode('month')} style={styles.modeButton}>
          <Text style={[styles.modeButtonText, { color: mode === 'month' ? colors.primary : colors.textMuted }]}>Month</Text>
        </Pressable>
      </View>
      <View style={styles.modeToggle}>
        <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
      </View>
      {/* Workstream H: per-layer toggles over calendar_events kinds, alongside (not replacing) showBeta above. */}
      <View style={styles.modeToggle}>
        <Toggle label="Jobs" value={showJobsLayer} onChange={setShowJobsLayer} />
        <Toggle label="Time Off" value={showTimeOffLayer} onChange={setShowTimeOffLayer} />
      </View>
      {mode === 'day' ? (
        <ScrollView style={styles.grid}>
          {HOURS.map((hour) => {
            const hourDate = new Date(selectedDay);
            hourDate.setHours(hour, 0, 0, 0);
            const hourJobs = jobsForHour(hour);
            const hourTimeOff = timeOffForHour(hour);
            return (
              <View key={hour} style={styles.hourRow}>
                <View style={styles.hourGutter}>
                  <Text style={styles.hourLabel}>{format(hourDate, 'h a')}</Text>
                </View>
                <View style={styles.hourLane}>
                  {hourJobs.map((job) => (
                    <Pressable
                      key={job.id}
                      onPress={() => router.push(`/job/${job.id}`)}
                      style={[styles.jobCard, { borderLeftWidth: 4, borderLeftColor: JOB_STATUS_COLORS[job.status] }]}
                    >
                      <Text style={styles.jobAddress}>{job.address ?? 'No address'}</Text>
                      <Text style={styles.jobStatus}>{job.status}</Text>
                    </Pressable>
                  ))}
                  {hourTimeOff.map((event) => (
                    <View key={event.id} style={[styles.jobCard, styles.timeOffCard]}>
                      <Text style={styles.jobAddress}>{event.title ?? 'Time off'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : mode === 'week' ? (
        <WeekView
          jobs={visibleJobs}
          anchorDay={selectedDay}
          timeOffEvents={visibleTimeOff}
          onSelectJob={(job) => router.push(`/job/${job.id}`)}
        />
      ) : (
        <MonthView
          jobs={visibleJobs}
          anchorDay={selectedDay}
          timeOffEvents={visibleTimeOff}
          onSelectDay={(d) => {
            setSelectedDay(d);
            setMode('day');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  navButtonText: {
    fontSize: typography.size.h3,
    color: colors.primary,
  },
  dayLabel: {
    fontSize: typography.size.h5,
    lineHeight: typography.size.h5 * typography.lineHeight.heading,
    color: colors.text,
  },
  grid: {
    flex: 1,
  },
  hourRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  hourGutter: {
    width: 56,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  hourLabel: {
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  hourLane: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    gap: spacing.xs,
  },
  jobCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  jobAddress: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.body,
    color: colors.text,
  },
  jobStatus: {
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  timeOffCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.textMuted,
    backgroundColor: colors.offWhite,
  },
  modeToggle: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  modeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  modeButtonText: {
    fontSize: typography.size.label,
  },
});
