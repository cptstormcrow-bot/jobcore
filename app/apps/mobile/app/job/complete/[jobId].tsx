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
import { completionBlockedNotice } from '../../../../../modules/field-tech/src/screens/completion-helpers';
import { useSession } from '../../../src/lib/session';
import { buildFieldTechPorts } from '../../../src/lib/field-tech-repos';
import { createJobRepository } from '../../../src/lib/admin-finance-repos';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';

type Loaded =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'blocked'; notice: string }
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

  let body: React.ReactNode;
  if (!ready || loaded.kind === 'loading') {
    body = <LoadingState />;
  } else if (loaded.kind === 'missing') {
    body = <EmptyState title="Job not found" message="This job could not be loaded." />;
  } else if (loaded.kind === 'blocked') {
    body = <EmptyState title="Cannot complete this job" message={loaded.notice} />;
  } else {
    body = <Completion job={loaded.job} onDone={onDone} persistCompletion={persistCompletion} />;
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
