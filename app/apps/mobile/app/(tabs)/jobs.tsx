// JobCore screen #0009 - jobs - Jobs
// P2e.3b / S2.3 - Job Detail host. JobDetail owns its own rendering; this
// screen just selects the job and passes it through.

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Job, JobStatus } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppChrome, Button, colors, EmptyState, spacing, Toggle } from '@jobcore/ui';
import { StaleDataHint } from '../../src/components/StaleDataHint';
import { JobDetail } from '../../src/components/JobDetail';
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

export default function JobsScreen() {
  const router = useRouter();
  const session = useSession();
  const role = session.status === 'authenticated' ? session.profile.role : undefined;
  const userId = session.status === 'authenticated' ? session.session.user.id : undefined;

  const isFinanceRole = role === 'owner' || role === 'admin';

  // #0009 is only a placeholder for owner/admin: their Jobs list is #0012 (the admin-finance
  // 'jobs' sub-view). replace (not push) keeps Back from returning here and bouncing forward again;
  // the ts nonce makes AdminFinanceRoot's effect re-fire if that screen is already mounted.
  useFocusEffect(
    useCallback(() => {
      if (isFinanceRole) router.replace(`/m/admin-finance?view=jobs&ts=${Date.now()}` as never);
    }, [isFinanceRole, router]),
  );

  const rev = useReadCacheRevision();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showBeta, setShowBeta] = useState(false);

  // Tech job query: fetch the signed-in tech's assigned job(s) via RLS
  // (jobs_select_tech / job_assignments join, per plan §Stale P4-spec prose).
  // Non-tech roles are untouched - no query fires and selectedJob stays null,
  // preserving the prior "no job data seam" placeholder behavior for them.
  useEffect(() => {
    if (role !== 'tech' || !userId) {
      setSelectedJob(null);
      return;
    }
    let cancelled = false;
    const fetchLive = async (): Promise<JobRow | null> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(JOB_ROW_COLUMNS)
        .eq('assigned_tech_id', userId)
        .limit(1)
        .maybeSingle<JobRow>();
      if (error) throw error;
      return data ?? null;
    };
    const identity = getReadCacheIdentity();
    const load = identity
      ? cachedRead<JobRow | null>(
          buildReadCacheKey(identity.orgId, identity.userId, 'app.jobs.list', { techId: userId }),
          fetchLive,
        ).then((r) => r.data)
      : fetchLive();
    void load
      .then((data) => {
        if (cancelled) return;
        setSelectedJob(data ? toJob(data) : null);
      })
      .catch(() => {
        if (!cancelled) setSelectedJob(null);
      });
    return () => {
      cancelled = true;
    };
  }, [role, userId, rev]);

  if (isFinanceRole) return null; // redirecting to #0012; skip the placeholder flash

  if (!selectedJob || !(isBetaVisible(selectedJob, showBeta) || selectedJob.source === 'job-simulator')) {
    return (
      <View style={styles.center}>
        <AppChrome
          helpContext={{ screenKey: 'jobs-list' }}
          breadcrumbSegments={[{ label: 'Jobs' }]}
          menuItems={[]}
          optionsItems={[]}
          titleBar={{ title: 'Jobs' }}
        />
        <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
        <Button label="New job" size="sm" onPress={() => router.push('/job/new')} />
        <EmptyState title="Jobs" message="No job selected. The job list lands in a later slice." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppChrome
        helpContext={{ screenKey: 'jobs-list' }}
        breadcrumbSegments={[{ label: 'Jobs' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Jobs' }}
      />
      <StaleDataHint queries={['app.jobs.']} />
      <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
      <Button label="New job" size="sm" onPress={() => router.push('/job/new')} />
      <JobDetail job={selectedJob} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.offWhite,
  },
});
