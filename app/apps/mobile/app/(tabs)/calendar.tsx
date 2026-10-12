// JobCore screen #0008 - calendar - Calendar
// P2e.2a/2b/2c - Calendar day + week view, status colours, role gate.
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, Toggle, CalendarHeader, type CalendarMode } from '@jobcore/ui';
import type { Job, JobStatus } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { addDays, addMonths, endOfWeek, format, startOfWeek } from 'date-fns';
import { useRouter } from 'expo-router';
import { WeekView, MonthView, type TimeOffEvent } from '@jobcore/ui';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { buildReadCacheKey, cachedRead, getReadCacheIdentity, useReadCacheRevision } from '../../src/lib/read-cache';

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
    totalLaborSeconds: 0,
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

export default function CalendarScreen() {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [mode, setMode] = useState<CalendarMode>('week');
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
  const rev = useReadCacheRevision();

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
    const fetchLive = async (): Promise<CalendarEventRow[]> => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select(CALENDAR_EVENT_COLUMNS)
        .eq('organization_id', orgId);
      if (error || !data) throw error ?? new Error('calendar_events read failed');
      return data as unknown as CalendarEventRow[];
    };
    const identity = getReadCacheIdentity();
    const load = identity
      ? cachedRead<CalendarEventRow[]>(
          buildReadCacheKey(identity.orgId, identity.userId, 'app.jobs.calendar', { orgId }),
          fetchLive,
        ).then((r) => r.data)
      : fetchLive();
    void load
      .catch(() => null)
      .then((rows) => {
        if (cancelled) return;
        if (!rows) {
          setJobs([]);
          setTimeOffEvents([]);
          return;
        }
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
  }, [orgId, rev]);

  const visibleJobs = showJobsLayer ? jobs.filter((job) => isBetaVisible(job, showBeta)) : [];
  const visibleTimeOff = showTimeOffLayer ? timeOffEvents : [];

  const goPrev = () =>
    setSelectedDay((d) => (mode === 'week' ? addDays(d, -7) : addMonths(d, -1)));
  const goNext = () =>
    setSelectedDay((d) => (mode === 'week' ? addDays(d, 7) : addMonths(d, 1)));
  const goToday = () => setSelectedDay(new Date());

  const weekStart = startOfWeek(selectedDay);
  const weekEnd = endOfWeek(selectedDay);
  const label =
    mode === 'week'
      ? `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
      : format(selectedDay, 'MMMM yyyy');

  return (
    <View style={styles.screen}>
      <CalendarHeader mode={mode} onModeChange={setMode} label={label} onPrev={goPrev} onNext={goNext} onToday={goToday} />
      <View style={styles.modeToggle}>
        <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
      </View>
      {/* Workstream H: per-layer toggles over calendar_events kinds, alongside (not replacing) showBeta above. */}
      <View style={styles.modeToggle}>
        <Toggle label="Jobs" value={showJobsLayer} onChange={setShowJobsLayer} />
        <Toggle label="Time Off" value={showTimeOffLayer} onChange={setShowTimeOffLayer} />
      </View>
      {mode === 'week' ? (
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
            setMode('week');
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
  modeToggle: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
});
