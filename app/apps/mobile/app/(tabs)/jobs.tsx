// P2e.3b / S2.3 - Job Detail host. The registry lookup lives HERE, not in JobDetail.tsx:
// the shared canvas stays free of any module coupling (spec 02-P2 L85-86) and
// receives module-contributed buttons as a plain `actions` prop.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Job, JobStatus } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { getEnabledModules, type JobAction } from '@jobcore/module-sdk';
import { colors, EmptyState, spacing, Toggle } from '@jobcore/ui';
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
  const session = useSession();
  const org = session.status === 'authenticated' ? session.organization : undefined;
  const role = session.status === 'authenticated' ? session.profile.role : undefined;
  const userId = session.status === 'authenticated' ? session.session.user.id : undefined;

  // Module-contributed buttons, resolved from the registry by enabled-module +
  // role. Never names a module id - only apps/mobile/src/modules.ts may do that.
  const actions = useMemo<JobAction[]>(() => {
    if (!org || !role) return [];
    return getEnabledModules(org, role).flatMap((m) => m.jobActions ?? []);
  }, [org, role]);

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

  // Generic onInvoke dispatch: names no module. Looks up the matched JobAction
  // by id and runs its onInvoke hook, if one is declared.
  const dispatchInvoke = useCallback(
    (actionId: string) => {
      const action = actions.find((a) => a.id === actionId);
      if (!selectedJob) return;
      void action?.onInvoke?.(selectedJob);
    },
    [actions, selectedJob],
  );

  if (!selectedJob || !isBetaVisible(selectedJob, showBeta)) {
    return (
      <View style={styles.center}>
        <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
        <EmptyState title="Jobs" message="No job selected. The job list lands in a later slice." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
      <JobDetail job={selectedJob} actions={actions} onAction={dispatchInvoke} role={role} />
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
