// JobCore screen #0008 - calendar - Calendar
// Thin wrapper: loads data, renders the shared UniversalCalendar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { colors } from '@jobcore/ui';
import type { Job, JobStatus } from '@jobcore/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { UniversalCalendar, parseCalendarDate, type UniversalCalendarEmployee } from '../../../../modules/admin-finance/src/screens/UniversalCalendar';
import { CalendarTimeOffSection } from '../../../../modules/admin-finance/src/components/CalendarTimeOffSection';
import type { TimeOffRequestAdmin } from '../../../../modules/admin-finance/src/data/time-off-repo';
import { setModuleSession as setAdminFinanceSourceModuleSession } from '../../../../modules/admin-finance/src/lib/module-session';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { createTimeOffAdminRepository } from '../../src/lib/admin-finance-repos';
import { createTimeOffRepository } from '../../src/lib/field-tech-repos';
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
  created_by: string | null;
  jobs: JobRow | null;
}

const CALENDAR_EVENT_COLUMNS = `id, organization_id, job_id, kind, title, description, event_time, created_by, jobs (${JOB_ROW_COLUMNS})`;

export default function CalendarScreen() {
  const params = useLocalSearchParams<{ date?: string; jobId?: string; returnTo?: string }>();
  const pick = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
  const dateParam = pick(params.date);
  const jobIdParam = pick(params.jobId);
  const returnToParam = pick(params.returnTo);
  const anchorDate = useMemo(() => {
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return undefined;
    const dt = parseCalendarDate(dateParam);
    return Number.isNaN(dt.getTime()) ? undefined : dt;
  }, [dateParam]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<UniversalCalendarEmployee[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequestAdmin[]>([]);
  const [timeOffRev, setTimeOffRev] = useState(0);
  const timeOffRepo = useMemo(() => createTimeOffAdminRepository(), []);
  const techTimeOffRepo = useMemo(() => createTimeOffRepository(), []);
  const router = useRouter();
  const rev = useReadCacheRevision();

  // Role gate (spec 02-P2 L83-84): owner/admin/sales see every tech's jobs, a tech only their own.
  // The component scopes tech views; this screen only passes the role and viewer id.
  const s = useSession();
  // createBlackout (admin-finance-repos.ts) reads the session through the relative SOURCE path.
  // Injected synchronously in the render body: child effects run before parent effects, and
  // the setters are idempotent module-scope writes.
  if (s.status === 'authenticated') {
    setAdminFinanceSourceModuleSession({ org: s.organization, role: s.profile.role, userId: s.profile.id });
  }
  const role = s.status === 'authenticated' ? s.profile.role : undefined;
  const viewerId = s.status === 'authenticated' ? s.profile.id : null;
  const orgId = s.status === 'authenticated' ? s.organization.id : undefined;

  // Org-scoped query only; calendar_events RLS returns the role-correct row set.
  useEffect(() => {
    if (!orgId) {
      setJobs([]);
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
          return;
        }
        // calendar_events is append-only; dedupe job-linked rows to one job per job_id.
        const jobMap = new Map<string, Job>();
        for (const row of rows) {
          if (row.job_id && row.jobs) jobMap.set(row.job_id, toJob(row.jobs));
        }
        setJobs(Array.from(jobMap.values()));
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, rev]);

  useEffect(() => {
    if (!orgId) {
      setEmployees([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from('profiles')
      .select('id, full_name, role, active')
      .eq('organization_id', orgId)
      .order('full_name')
      .then(({ data }) => {
        if (cancelled || !data) return;
        setEmployees(
          (data as Array<{ id: string; full_name: string | null; role: string; active: boolean }>).map((p) => ({
            id: p.id,
            fullName: p.full_name ?? 'Tech',
            role: p.role,
            active: p.active,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      setTimeOffRequests([]);
      return;
    }
    let cancelled = false;
    void timeOffRepo
      .listForOrganization(orgId)
      .then((list) => {
        if (!cancelled) setTimeOffRequests(list);
      })
      .catch(() => {
        if (!cancelled) setTimeOffRequests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, timeOffRepo, timeOffRev, rev]);

  const onReturn = useCallback((): void => {
    if (returnToParam) router.push(returnToParam as never);
    else if (jobIdParam) router.push({ pathname: '/job/[jobId]', params: { jobId: jobIdParam, panel: 'plan' } });
    else router.back();
  }, [router, returnToParam, jobIdParam]);
  const showReturn = Boolean(jobIdParam || returnToParam);

  const onSaveBlackouts = async (isoDays: string[], techId: string): Promise<void> => {
    if (!orgId) return;
    for (const day of isoDays) {
      await timeOffRepo.createBlackout(orgId, techId, { startDate: day, endDate: day, reason: null });
    }
    setTimeOffRev((n) => n + 1);
  };

  const isAdminRole = Boolean(role && role !== 'tech');

  const onSubmitTimeOff = async (
    draft: { startDate: string; endDate: string; reason: string | null },
    techId: string,
  ): Promise<void> => {
    if (!orgId) return;
    if (isAdminRole) await timeOffRepo.createBlackout(orgId, techId, draft);
    else await techTimeOffRepo.create(orgId, techId, draft);
    setTimeOffRev((n) => n + 1);
  };

  const onCancelTimeOff = async (requestId: string): Promise<void> => {
    if (isAdminRole) await timeOffRepo.cancel(requestId);
    else await techTimeOffRepo.cancel(requestId);
    setTimeOffRev((n) => n + 1);
  };

  const calendarNode = (
    <UniversalCalendar
        role={role && role !== 'tech' ? 'admin' : 'tech'}
        viewerId={viewerId}
        jobs={jobs}
        employees={employees}
        timeOffRequests={timeOffRequests}
        anchorDate={anchorDate}
        {...(showReturn ? { onReturn, returnLabel: jobIdParam ? 'Job' : 'Back' } : {})}
        onSelectJob={(job) => router.push({ pathname: '/job/[jobId]', params: { jobId: job.id, panel: 'plan' } })}
        onSaveBlackouts={onSaveBlackouts}
        onSubmitTimeOff={onSubmitTimeOff}
        onCancelTimeOff={onCancelTimeOff}
      />
  );

  if (isAdminRole) {
    return (
      <ScrollView style={styles.screen}>
        <View style={styles.calendarBlock}>{calendarNode}</View>
        <CalendarTimeOffSection
          timeOffAdmin={timeOffRepo}
          techs={employees.filter((e) => e.role === 'tech' && e.active)}
          onChanged={() => setTimeOffRev((n) => n + 1)}
        />
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <UniversalCalendar
        role={role && role !== 'tech' ? 'admin' : 'tech'}
        viewerId={viewerId}
        jobs={jobs}
        employees={employees}
        timeOffRequests={timeOffRequests}
        anchorDate={anchorDate}
        {...(showReturn ? { onReturn, returnLabel: jobIdParam ? 'Job' : 'Back' } : {})}
        onSelectJob={(job) => router.push({ pathname: '/job/[jobId]', params: { jobId: job.id, panel: 'plan' } })}
        onSaveBlackouts={onSaveBlackouts}
        onSubmitTimeOff={onSubmitTimeOff}
        onCancelTimeOff={onCancelTimeOff}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  calendarBlock: {
    height: 720,
  },
});
