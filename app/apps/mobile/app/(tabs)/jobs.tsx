// P2e.3b / S2.3 - Job Detail host. JobDetail owns its own rendering; this
// screen just selects the job and passes it through.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Job, JobStatus } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { useRouter } from 'expo-router';
import { Button, colors, EmptyState, spacing, Toggle } from '@jobcore/ui';
import { JobDetail } from '../../src/components/JobDetail';
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

export default function JobsScreen() {
  const router = useRouter();
  const session = useSession();
  const role = session.status === 'authenticated' ? session.profile.role : undefined;
  const userId = session.status === 'authenticated' ? session.session.user.id : undefined;

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
    void supabase
      .from('jobs')
      .select(JOB_ROW_COLUMNS)
      .eq('assigned_tech_id', userId)
      .limit(1)
      .maybeSingle<JobRow>()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setSelectedJob(null);
          return;
        }
        setSelectedJob(toJob(data));
      });
    return () => {
      cancelled = true;
    };
  }, [role, userId]);

  if (!selectedJob || !isBetaVisible(selectedJob, showBeta)) {
    return (
      <View style={styles.center}>
        <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
        <Button label="New job" size="sm" onPress={() => router.push('/job/new')} />
        <EmptyState title="Jobs" message="No job selected. The job list lands in a later slice." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
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
