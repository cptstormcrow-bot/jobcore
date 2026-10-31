import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Job } from '@jobcore/core';
import { estimateStageFlags } from '@jobcore/core';
import { AppChrome, EmptyState, JobProgressBar, LoadingState, colors, spacing } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';
import {
  setModuleSession as setAdminFinanceSourceModuleSession,
} from '../../../../../modules/admin-finance/src/lib/module-session';
import { setModuleSession as setFieldTechModuleSession } from '../../../../../modules/field-tech/src/lib/module-session';
import { setModulePorts as setFieldTechModulePorts } from '../../../../../modules/field-tech/src/lib/module-ports';
import { Completion } from '../../../../../modules/field-tech/src/screens/Completion';
import { CompletedReview } from '../../../../../modules/field-tech/src/screens/CompletedReview';
import { completionBlockedNotice, isAlreadyComplete } from '../../../../../modules/field-tech/src/screens/completion-helpers';
import { useSession, signOut } from '../../../src/lib/session';
import { JobHeader } from '../../../src/components/JobHeader';
import { useJobStageTimeline } from '../../../src/lib/useJobStageTimeline';
import { buildFieldTechPorts } from '../../../src/lib/field-tech-repos';
import type { Customer } from '../../../../../modules/admin-finance/src/data/ports';
import { createJobRepository, createCustomerRepository } from '../../../src/lib/admin-finance-repos';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import { JobAfterPhotoCard } from '../../../src/components/JobAfterPhotoCard';
import { liveLaborSeconds } from '../../../src/lib/live-labor';
import { markPaidIfSettled } from '../../../src/lib/settle-on-completion';

type Loaded =
  | { kind: 'loading' }
  | { kind: 'missing'; reason?: string }
  | { kind: 'blocked'; notice: string; job: Job }
  | { kind: 'completed'; job: Job }
  | { kind: 'ready'; job: Job };

export default function CompleteJobRoute() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const state = useSession();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });

  if (state.status === 'authenticated') {
    const session = { org: state.organization, role: state.profile.role, userId: state.profile.id };
    setAdminFinanceSourceModuleSession(session);
    setFieldTechModuleSession(session);
    setFieldTechModulePorts(buildFieldTechPorts({ orgId: state.organization.id, userId: state.profile.id }));
  }
  const ready = state.status === 'authenticated';
  const role = state.status === 'authenticated' ? state.profile.role : undefined;
  const isAdmin = role === 'admin' || role === 'owner';
  const isTech = role === 'tech';
  const [customer, setCustomer] = useState<Customer | null>(null);
  const headerJob = loaded.kind === 'loading' || loaded.kind === 'missing' ? null : loaded.job;
  const { stageResults, stageList, estimate } =useJobStageTimeline(headerJob, ready && !!headerJob);

  useEffect(() => {
    const customerId = headerJob?.customerId;
    if (!ready || !customerId) {
      setCustomer(null);
      return undefined;
    }
    let cancelled = false;
    createCustomerRepository()
      .getById(customerId)
      .then((c) => {
        if (!cancelled) setCustomer(c);
      })
      .catch(() => {
        if (!cancelled) setCustomer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, headerJob?.customerId]);

  const go = (panel: string) => {
    if (headerJob) router.replace(`/job/${headerJob.id}?panel=${panel}` as never);
  };

  useEffect(() => {
    if (!ready || !jobId) return undefined;
    let cancelled = false;
    createJobRepository()
      .getById(jobId)
      .then((job) => {
        if (cancelled) return;
        if (!job) {
          setLoaded({ kind: 'missing' });
          return;
        }
        if (isAlreadyComplete(job)) {
          setLoaded({ kind: 'completed', job });
          return;
        }
        const notice = completionBlockedNotice(job);
        setLoaded(notice ? { kind: 'blocked', notice, job } : { kind: 'ready', job });
      })
      .catch((err: unknown) => {
        // Keep the real cause on screen so a failed load is not mistaken for a deleted job.
        if (!cancelled) setLoaded({ kind: 'missing', reason: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, jobId]);

  const onDone = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: '/job/[jobId]', params: { jobId } } as never);
    }
  };

  const persistCompletion = async (job: Job): Promise<void> => {
    const repo = createJobRepository();
    await repo.getById(job.id);
    await repo.patchLifecycle(job.id, { completedAt: new Date().toISOString() });
    await repo.updateStatus(job.id, 'completed');
    await markPaidIfSettled(role ?? '', { ...job, status: 'completed' });
  };

  // Reopen: clearing the start time then setting it again makes the DB open a fresh labor segment.
  // The first segment stays in job_time_segments, so total hours keep accumulating across visits.
  const reopenJob = async (job: Job): Promise<void> => {
    const repo = createJobRepository();
    await repo.patchLifecycle(job.id, { completedAt: null, inProgressAt: null });
    await repo.patchLifecycle(job.id, { inProgressAt: new Date().toISOString() });
    await repo.updateStatus(job.id, 'in_progress');
    onDone();
  };

  let body: React.ReactNode;
  if (!ready || loaded.kind === 'loading') {
    body = <LoadingState />;
  } else if (loaded.kind === 'missing') {
    body = (
      <EmptyState
        title="Job not found"
        message={loaded.reason ? `This job could not be loaded.

${loaded.reason}` : 'This job could not be loaded.'}
      />
    );
  } else if (loaded.kind === 'blocked') {
    body = <EmptyState title="Cannot complete this job" message={loaded.notice} />;
  } else if (loaded.kind === 'completed') {
    const doneJob = loaded.job;
    const doneSeconds = liveLaborSeconds({
      storedSeconds: doneJob.totalLaborSeconds,
      openSegmentStartIso: doneJob.inProgressAt,
      completedAt: doneJob.completedAt,
      nowMs: Date.now(),
    });
    body = (
      <CompletedReview
        job={doneJob}
        timeSpentSeconds={doneSeconds}
        canReopen={doneJob.status === 'completed'}
        onReopen={() => reopenJob(doneJob)}
        renderAfterPhotos={({ onCountChange, disabled }) => (
          <JobAfterPhotoCard
            jobId={doneJob.id}
            jobNumber={doneJob.jobNumber ?? null}
            onCountChange={onCountChange}
            disabled={disabled}
          />
        )}
      />
    );
  } else {
    // Time Spent: same helper/inputs as the job header's Total Hours; computed once (no timer).
    const timeSpentSeconds = liveLaborSeconds({
      storedSeconds: loaded.job.totalLaborSeconds,
      openSegmentStartIso: loaded.job.inProgressAt,
      completedAt: loaded.job.completedAt,
      nowMs: Date.now(),
    });
    const readyJob = loaded.job;
    body = (
      <Completion
        job={readyJob}
        onDone={onDone}
        persistCompletion={persistCompletion}
        timeSpentSeconds={timeSpentSeconds}
        renderAfterPhotos={({ onCountChange, disabled }) => (
          <JobAfterPhotoCard
            jobId={readyJob.id}
            jobNumber={readyJob.jobNumber ?? null}
            onCountChange={onCountChange}
            disabled={disabled}
          />
        )}
      />
    );
  }

  const menuItems: MenuItem[] = [
    { id: 'plan', label: 'Job', onPress: () => go('plan') },
    { id: 'evisit', label: isAdmin ? 'Prelim' : 'Prelim (Prem)', onPress: () => go('jobInvestigation') },
    { id: 'estimate', helpId: 'approve_estimate', label: 'Estimate', onPress: () => go('jobEstimate') },
    ...(isAdmin ? ([{ id: 'assign', helpId: 'assign', label: 'Assign', onPress: () => go('assign') }] as MenuItem[]) : []),
    ...(role !== 'tech' && !isAdmin ? [{ id: 'needs-prem', label: 'Needs Prem', onPress: () => go('plan') }] : []),
    { id: 'schedule', label: 'Schedule', onPress: () => go('schedule') },
    { id: 'contact', helpId: 'contact', label: 'Contact', onPress: () => go('plan') },
    { id: 'arrive', helpId: 'arrive', label: 'Arrive', onPress: () => go('plan'), disabled: !headerJob?.assignedTechId },
    { id: 'complete', helpId: 'complete', label: 'Complete', onPress: () => {}, isActive: true },
    ...(role === 'owner' || role === 'admin'
      ? ([{ id: 'paid', helpId: 'paid', label: 'Paid', onPress: () => go('payment') }] as MenuItem[])
      : []),
    ...(role === 'owner' || role === 'admin'
      ? ([{ id: 'closeout', helpId: 'job_closeout', label: 'Close-out', onPress: () => go('closeout') }] as MenuItem[])
      : []),
    ...(isAdmin || isTech
      ? []
      : ([
          { id: 'sign-out', label: 'Sign out', onPress: () => void signOut() },
          {
            id: 'configuration',
            label: 'Configuration',
            onPress: () => {},
            submenu: [{ id: 'config-settings', label: 'Settings', onPress: () => router.push('/config/settings') }],
          },
        ] as MenuItem[])),
  ];

  const handleStagePress = (key: string) => {
    switch (key) {
      case 'job': go('plan'); break;
      case 'premAvailable':
      case 'completePrem': go('jobInvestigation'); break;
      case 'estimate':
      case 'approval':
      case 'startWork':
      case 'photos': go('jobEstimate'); break;
      case 'schedule': go('schedule'); break;
      case 'assign': go('assign'); break;
      case 'history': go('history'); break;
      default: break;
    }
  };

  return (
    <View style={styles.screen}>
      {headerJob ? (
        <>
          <JobHeader
            job={headerJob}
            customer={customer}
            totalLaborSeconds={headerJob.totalLaborSeconds ?? 0}
            jobDetailMenuItems={menuItems}
            optionsItems={[]}
            showBack={isAdmin || isTech ? false : undefined}
            compactMenu={isAdmin || isTech || undefined}
            fitMenu={isAdmin || isTech || undefined}
            onSchedulePress={() => go('schedule')}
            gearItems={isAdmin || isTech ? [
              { id: 'gear-logins', label: 'Logins', onPress: () => router.push('/account') },
              { id: 'gear-settings', label: 'Settings', onPress: () => router.push('/config/settings') },
              { id: 'gear-profile', label: 'Profile', onPress: () => router.push('/profile') },
              { id: 'gear-test-jobs', label: 'Test Jobs', onPress: () => router.push('/config/test-jobs') },
            ] : undefined}
            gearTitle={isAdmin || isTech ? 'Configuration' : undefined}
            onLogoPress={isAdmin ? () => (router.canGoBack() ? router.back() : router.replace('/m/admin-finance')) : isTech ? () => router.push('/m/field-tech') : undefined}
          >
            {stageResults ? (
              <JobProgressBar
                stages={stageList}
                states={stageResults.states}
                nextStep={stageResults.nextStep ?? ''}
                onStagePress={handleStagePress}
                disabledKeys={['lead']}
                testID="job-progress-bar"
              />
            ) : null}
          </JobHeader>
          <View style={[styles.rule, { backgroundColor: headerJob?.status === 'paid' || headerJob?.status === 'closed' ? colors.paidBar : estimateStageFlags(estimate?.status ?? null).approvalComplete ? colors.estimateApprovedBar : colors.text }]} />
        </>
      ) : (
        <AppChrome breadcrumbSegments={[{ label: 'Complete Job' }]} menuItems={[]} titleBar={{ title: 'Complete Job' }} />
      )}
      <View style={styles.body}>
        <ErrorBoundary>{body}</ErrorBoundary>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  body: { flex: 1 },
  rule: { height: 3, backgroundColor: colors.text, width: '100%', marginTop: Math.round(spacing.sm * 0.67) },
});
