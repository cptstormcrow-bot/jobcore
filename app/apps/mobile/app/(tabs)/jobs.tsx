// JobCore screen #0009 - jobs - Jobs
// Your Jobs: the jobs assigned to the signed-in user (job_assignments, installer or
// investigator). Owner and admin are sent to #0012 instead. Tapping a row opens the job.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { Job } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppChrome, EmptyState, ListItem, LoadingState, PayrollButton, Toggle, colors, spacing } from '@jobcore/ui';
import { StaleDataHint } from '../../src/components/StaleDataHint';
import { createTechJobRepository } from '../../src/lib/field-tech-repos';
import { useSession } from '../../src/lib/session';
import { useReadCacheRevision } from '../../src/lib/read-cache';

const statusText = (status: string) => {
  const words = status.replace(/[_-]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export default function JobsScreen() {
  const router = useRouter();
  const session = useSession();
  const role = session.status === 'authenticated' ? session.profile.role : undefined;
  const userId = session.status === 'authenticated' ? session.session.user.id : undefined;

  const isFinanceRole = role === 'owner' || role === 'admin';

  // Owner/admin's Jobs list is #0012 (the admin-finance 'jobs' sub-view). replace (not push)
  // keeps Back from returning here and bouncing forward again; the ts nonce makes
  // AdminFinanceRoot's effect re-fire if that screen is already mounted.
  useFocusEffect(
    useCallback(() => {
      if (isFinanceRole) router.replace(`/m/admin-finance?view=jobs&ts=${Date.now()}` as never);
    }, [isFinanceRole, router]),
  );

  const rev = useReadCacheRevision();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [showBeta, setShowBeta] = useState(false);
  const techJobs = useMemo(() => createTechJobRepository(), []);

  useEffect(() => {
    if (isFinanceRole || !userId) {
      setJobs([]);
      return;
    }
    let cancelled = false;
    void techJobs
      .listAssignedToTech(userId)
      .then((rows) => {
        if (!cancelled) setJobs(rows);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isFinanceRole, userId, techJobs, rev]);

  const visibleJobs = useMemo(
    () =>
      (jobs ?? [])
        .filter((job) => isBetaVisible(job, showBeta) || job.source === 'job-simulator')
        .sort((a, b) => (b.jobNumber ?? 0) - (a.jobNumber ?? 0)),
    [jobs, showBeta],
  );

  if (isFinanceRole) return null; // redirecting to #0012; skip the flash

  return (
    <View style={styles.root}>
      <AppChrome
        helpContext={{ screenKey: 'jobs-list' }}
        breadcrumbSegments={[{ label: 'Jobs' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Jobs' }}
      />
      <StaleDataHint queries={['ft.jobs.']} />
      <View style={styles.controls}>
        <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />
        <PayrollButton label="New job" onPress={() => router.push('/job/new')} />
      </View>
      {jobs === null ? (
        <LoadingState />
      ) : (
        <FlatList
          style={styles.list}
          data={visibleJobs}
          keyExtractor={(job) => job.id}
          ListEmptyComponent={<EmptyState title="No jobs" message="No jobs are assigned to you." />}
          renderItem={({ item: job }) => (
            <ListItem
              title={`Job #${job.jobNumber ?? ''} ${job.customerName ?? ''}`.trim()}
              subtitle={job.address ?? undefined}
              footer={statusText(job.status)}
              onPress={() => router.push({ pathname: '/job/[jobId]', params: { jobId: job.id } })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  list: { flex: 1 },
});
