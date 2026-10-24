import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Job } from '@jobcore/core';
import { AppChrome, EmptyState, LoadingState, colors } from '@jobcore/ui';
import {
  setModuleSession as setAdminFinanceSourceModuleSession,
} from '../../../../../modules/admin-finance/src/lib/module-session';
import { setModuleSession as setFieldTechModuleSession } from '../../../../../modules/field-tech/src/lib/module-session';
import { setModulePorts as setFieldTechModulePorts } from '../../../../../modules/field-tech/src/lib/module-ports';
import { Completion } from '../../../../../modules/field-tech/src/screens/Completion';
import { CompletedReview } from '../../../../../modules/field-tech/src/screens/CompletedReview';
import { completionBlockedNotice, isAlreadyComplete } from '../../../../../modules/field-tech/src/screens/completion-helpers';
import { useSession } from '../../../src/lib/session';
import { buildFieldTechPorts } from '../../../src/lib/field-tech-repos';
import { createJobRepository } from '../../../src/lib/admin-finance-repos';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';
import { JobAfterPhotoCard } from '../../../src/components/JobAfterPhotoCard';
import { liveLaborSeconds } from '../../../src/lib/live-labor';

type Loaded =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'blocked'; notice: string }
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
        setLoaded(notice ? { kind: 'blocked', notice } : { kind: 'ready', job });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ kind: 'missing' });
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
    body = <EmptyState title="Job not found" message="This job could not be loaded." />;
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

  return (
    <View style={styles.screen}>
      <AppChrome breadcrumbSegments={[{ label: 'Complete Job' }]} menuItems={[]} titleBar={{ title: 'Complete Job' }} />
      <ErrorBoundary>{body}</ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
});
