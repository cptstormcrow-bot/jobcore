// JobCore screen #0047 - af-timeOffQueue - Time Off
/**
 * Time-off queue screen — read-only status history (Workstream F, 4b), plus
 * admin-created blackouts (Workstream F, 4c).
 *
 * Consumes `TimeOffAdminRepo` (`../data/time-off-repo.ts`): `listForOrganization`
 * and `cancel`. Mirrors `ReimbursementQueueScreen.tsx`'s
 * optional-props pattern, `getModuleSession` session gate, and
 * idle/loading/loaded/failed state machine exactly, so the two admin queue
 * screens stay consistent.
 *
 * `listForOrganization` returns requests in ANY status — the pending queue
 * filters to `status === 'pending'` client-side, since the port exposes no
 * status-scoped query of its own (same discipline as the reimbursement
 * queue). Approve/deny decisions are now made by a database trigger at
 * insert time (first-come-first-served on job-assignment date conflicts);
 * this screen has no admin action of its own for pending requests.
 *
 * Admin-created blackouts insert directly as `'approved'` (`createBlackout`
 * on `TimeOffAdminRepo`, invoked from `onAddBlackout`'s destination screen —
 * `BlackoutEditorScreen.tsx` — not from here), so they never appear in the
 * pending queue above; they surface in the "Upcoming Blackouts" section
 * instead, alongside any other approved, not-yet-ended request regardless of
 * who created it. Cancel uses a per-row `ActionState`, mirrors
 * `PayoutBatchScreen.tsx`'s `Record<string, ActionState>` keyed-by-id
 * pattern for its approve/mark-paid actions.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useReadCacheRevision } from '../lib/read-cache';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing, typography, Text } from '@jobcore/ui';
import type { TimeOffRequestAdmin, TimeOffAdminRepo } from '../data/time-off-repo';
import { getModuleSession } from '../lib/module-session';
import type { Profile } from '@jobcore/core';
import { TimeOffTechCalendar } from './TimeOffTechCalendar';

export interface TimeOffQueueScreenProps {
  timeOffAdmin?: TimeOffAdminRepo;
  /** Fired when the "Add Blackout" button is pressed. */
  onAddBlackout?: () => void;
  /** Active techs for the blackout calendar's tech picker. */
  techs?: Profile[];
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: TimeOffRequestAdmin[] }
  | { kind: 'failed'; message: string };

/** Per-request cancel-action state, keyed by request id. Absent = idle. */
type ActionState =
  | { kind: 'working' }
  | { kind: 'failed'; message: string };

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export function TimeOffQueueScreen(props: TimeOffQueueScreenProps = {}) {
  const { timeOffAdmin, onAddBlackout, techs = [] } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [cancelActions, setCancelActions] = useState<Record<string, ActionState>>({});

  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!session || !timeOffAdmin) {
      return;
    }
    let cancelled = false;
    if (!hasLoadedRef.current) setLoadState({ kind: 'loading' });
    timeOffAdmin
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          hasLoadedRef.current = true;
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
  }, [session, timeOffAdmin, rev]);

  function handleCancel(requestId: string) {
    if (!timeOffAdmin) {
      return;
    }
    setCancelActions((prev) => ({ ...prev, [requestId]: { kind: 'working' } }));
    timeOffAdmin
      .cancel(requestId)
      .then(() => {
        setLoadState((prev) => {
          if (prev.kind !== 'loaded') {
            return prev;
          }
          return { kind: 'loaded', items: prev.items.filter((existing) => existing.id !== requestId) };
        });
        setCancelActions((prev) => {
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not cancel this blackout.';
        setCancelActions((prev) => ({ ...prev, [requestId]: { kind: 'failed', message } }));
      });
  }

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
  const today = new Date().toISOString().slice(0, 10);
  const upcomingBlackouts = loadState.items.filter(
    (item) => item.status === 'approved' && item.endDate >= today,
  );

  const addBlackoutButton = (
    <Button
      label="Add Blackout"
      onPress={() => onAddBlackout?.()}
      disabled={!onAddBlackout}
      style={styles.action}
    />
  );

  if (pending.length === 0) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenTitle title="Time Off" />
          {addBlackoutButton}
          <EmptyState title="Time Off" message="No time-off requests are awaiting review." />
          {upcomingBlackouts.length > 0 ? (
            <>
              <Text style={styles.groupHeading}>Upcoming Blackouts</Text>
              <Card style={styles.card}>
                {upcomingBlackouts.map((item) => {
                  const rowState = cancelActions[item.id] ?? { kind: 'idle' as const };
                  return (
                    <View key={item.id} style={styles.row}>
                      <ListItem
                        title={`${formatDate(item.startDate)} – ${formatDate(item.endDate)}`}
                        subtitle={item.reason ?? 'No reason provided'}
                      />
                      <Button
                        label="Cancel"
                        onPress={() => handleCancel(item.id)}
                        disabled={rowState.kind === 'working'}
                        style={styles.action}
                      />
                      {rowState.kind === 'failed' ? <ErrorState message={rowState.message} /> : null}
                    </View>
                  );
                })}
              </Card>
            </>
          ) : null}
          <TimeOffTechCalendar rows={loadState.items} techs={techs} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Time Off" />
        {addBlackoutButton}
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

        {upcomingBlackouts.length > 0 ? (
          <>
            <Text style={styles.groupHeading}>Upcoming Blackouts</Text>
            <Card style={styles.card}>
              {upcomingBlackouts.map((item) => {
                const rowState = cancelActions[item.id] ?? { kind: 'idle' as const };
                return (
                  <View key={item.id} style={styles.row}>
                    <ListItem
                      title={`${formatDate(item.startDate)} – ${formatDate(item.endDate)}`}
                      subtitle={item.reason ?? 'No reason provided'}
                    />
                    <Button
                      label="Cancel"
                      onPress={() => handleCancel(item.id)}
                      disabled={rowState.kind === 'working'}
                      style={styles.action}
                    />
                    {rowState.kind === 'failed' ? <ErrorState message={rowState.message} /> : null}
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
        <TimeOffTechCalendar rows={loadState.items} techs={techs} />
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
  action: {
    marginBottom: spacing.sm,
  },
});
