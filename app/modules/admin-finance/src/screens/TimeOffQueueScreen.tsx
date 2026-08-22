/**
 * Time-off queue screen — read-only status history (Workstream F, 4b).
 *
 * Consumes `TimeOffAdminRepo` (`../data/time-off-repo.ts`): `listForOrganization`
 * is the only method used. Mirrors `ReimbursementQueueScreen.tsx`'s
 * optional-props pattern, `getModuleSession` session gate, and
 * idle/loading/loaded/failed state machine exactly, so the two admin queue
 * screens stay consistent.
 *
 * `listForOrganization` returns requests in ANY status — this screen filters
 * to `status === 'pending'` client-side, since the port exposes no
 * status-scoped query of its own (same discipline as the reimbursement
 * queue). Approve/deny decisions are now made by a database trigger at
 * insert time (first-come-first-served on job-assignment date conflicts);
 * this screen has no admin action of its own.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, EmptyState, LoadingState, ErrorState, colors, spacing, typography } from '@jobcore/ui';
import type { TimeOffRequestAdmin, TimeOffAdminRepo } from '../data/time-off-repo';
import { getModuleSession } from '../lib/module-session';

export interface TimeOffQueueScreenProps {
  timeOffAdmin?: TimeOffAdminRepo;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: TimeOffRequestAdmin[] }
  | { kind: 'failed'; message: string };

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export function TimeOffQueueScreen(props: TimeOffQueueScreenProps = {}) {
  const { timeOffAdmin } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });

  const session = getModuleSession();

  useEffect(() => {
    if (!session || !timeOffAdmin) {
      return;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    timeOffAdmin
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', items: result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load time-off requests.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, timeOffAdmin]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Time Off" message="Sign in to view this organization's time-off queue." />
      </View>
    );
  }

  if (!timeOffAdmin) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Time Off" message="No data source is connected for this module yet." />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading time-off requests..." />
      </View>
    );
  }

  if (loadState.kind === 'failed') {
    return (
      <View style={styles.screen}>
        <ErrorState message={loadState.message} />
      </View>
    );
  }

  const pending = loadState.items.filter((item) => item.status === 'pending');

  if (pending.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Time Off" message="No time-off requests are awaiting review." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.groupHeading}>Pending Review</Text>
        <Card style={styles.card}>
          {pending.map((item) => {
            return (
              <View key={item.id} style={styles.row}>
                <ListItem
                  title={`${formatDate(item.startDate)} – ${formatDate(item.endDate)}`}
                  subtitle={item.reason ?? 'No reason provided'}
                />
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

export default TimeOffQueueScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  groupHeading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    marginBottom: spacing.md,
  },
});
