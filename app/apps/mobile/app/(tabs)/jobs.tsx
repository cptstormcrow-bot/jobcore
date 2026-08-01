// P2e.3b - Job Detail host. The registry lookup lives HERE, not in JobDetail.tsx:
// the shared canvas stays free of any module coupling (spec 02-P2 L85-86) and
// receives module-contributed buttons as a plain `actions` prop.
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Job } from '@jobcore/core';
import { getEnabledModules } from '@jobcore/module-sdk';
import { colors, EmptyState, spacing } from '@jobcore/ui';
import { JobDetail } from '../../src/components/JobDetail';
import { useSession } from '../../src/lib/session';

// No job data seam exists yet (no query/cache anywhere in the app), so the host
// renders nothing until a later slice supplies one. Wiring a real source is out
// of scope for P2-e.
const selectedJob: Job | null = null;

export default function JobsScreen() {
  const session = useSession();
  const org = session.status === 'authenticated' ? session.organization : undefined;
  const role = session.status === 'authenticated' ? session.profile.role : undefined;

  // Module-contributed buttons, resolved from the registry by enabled-module +
  // role. Never names a module id - only apps/mobile/src/modules.ts may do that.
  const actions = useMemo(() => {
    if (!org || !role) return [];
    return getEnabledModules(org, role).flatMap((m) => m.jobActions ?? []);
  }, [org, role]);

  if (!selectedJob) {
    return (
      <View style={styles.center}>
        <EmptyState title="Jobs" message="No job selected. The job list lands in a later slice." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <JobDetail job={selectedJob} actions={actions} onAction={() => {}} />
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
