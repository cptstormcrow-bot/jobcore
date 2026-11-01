// JobCore screen #0008 - calendar - Calendar (admin Time Off section, re-homed from #0047 af-timeOffQueue)
/**
 * Admin-only Time Off section rendered under the Calendar: org-wide Pending Review,
 * org-wide Upcoming Blackouts with per-row Cancel, and an Add Blackout entry that
 * opens the existing BlackoutEditorScreen in a modal, in place. Ported verbatim from
 * TimeOffQueueScreen.tsx (same repo calls, copy and behavior).
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { Card, ListItem, LoadingState, ErrorState, PayrollButton, colors, spacing, typography, Text, ScreenNumberBadge } from '@jobcore/ui';
import type { Profile } from '@jobcore/core';
import type { TimeOffRequestAdmin, TimeOffAdminRepo } from '../data/time-off-repo';
import { getModuleSession } from '../lib/module-session';
import { useReadCacheRevision } from '../lib/read-cache';
import { BlackoutEditorScreen } from '../screens/BlackoutEditorScreen';

export interface CalendarTimeOffSectionProps {
  timeOffAdmin?: TimeOffAdminRepo;
  /** Active techs for the blackout editor's tech picker. */
  techs?: Array<{ id: string; fullName: string }>;
  /** Fired after the editor saves or changes blackouts, so the host can refresh its calendar. */
  onChanged?: () => void;
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

export function CalendarTimeOffSection(props: CalendarTimeOffSectionProps = {}) {
  // The editor opens in a Modal, which covers the app-wide badge, so it carries its own.
  const pathname = usePathname();
  const { timeOffAdmin, techs = [], onChanged } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [cancelActions, setCancelActions] = useState<Record<string, ActionState>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [session, timeOffAdmin, rev, reloadKey]);

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
        onChanged?.();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not cancel this blackout.';
        setCancelActions((prev) => ({ ...prev, [requestId]: { kind: 'failed', message } }));
      });
  }

  function closeEditor() {
    setEditorOpen(false);
    setReloadKey((n) => n + 1);
  }

  if (!session || !timeOffAdmin) {
    return null;
  }

  const addBlackoutButton = (
    <PayrollButton label="Add Blackout" onPress={() => setEditorOpen(true)} style={styles.action} />
  );

  let body: React.ReactNode;
  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    body = <LoadingState label="Loading time-off requests..." />;
  } else if (loadState.kind === 'failed') {
    body = <ErrorState message={loadState.message} />;
  } else {
    const pending = loadState.items.filter((item) => item.status === 'pending');
    const today = new Date().toISOString().slice(0, 10);
    const upcomingBlackouts = loadState.items.filter(
      (item) => item.status === 'approved' && item.endDate >= today,
    );
    body = (
      <>
        {pending.length === 0 ? (
          <Text style={styles.groupHeading}>No time-off requests are awaiting review.</Text>
        ) : (
          <>
            <Text style={styles.groupHeading}>Pending Review</Text>
            <Card style={styles.card}>
              {pending.map((item) => (
                <View key={item.id} style={styles.row}>
                  <ListItem
                    title={`${formatDate(item.startDate)} – ${formatDate(item.endDate)}`}
                    subtitle={item.reason ?? 'No reason provided'}
                  />
                </View>
              ))}
            </Card>
          </>
        )}
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
                    <PayrollButton
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
      </>
    );
  }

  return (
    <View style={styles.section}>
      {addBlackoutButton}
      {body}
      <Modal visible={editorOpen} animationType="slide" onRequestClose={closeEditor}>
        <BlackoutEditorScreen
          techs={techs as unknown as Profile[]}
          timeOffAdmin={timeOffAdmin}
          onSaved={() => {
            onChanged?.();
            closeEditor();
          }}
          onChanged={() => {
            onChanged?.();
            setReloadKey((n) => n + 1);
          }}
          onCancel={closeEditor}
        />
        <ScreenNumberBadge pathname={pathname} />
      </Modal>
    </View>
  );
}

export default CalendarTimeOffSection;

const styles = StyleSheet.create({
  section: {
    padding: spacing.md,
    backgroundColor: colors.offWhite,
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
