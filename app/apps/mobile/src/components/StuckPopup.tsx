/**
 * Screen #0099 - stuck-popup. Pops up over any screen when a queued change is
 * stuck (failed, or retried twice or more), lists the oldest few, and lets the
 * user unstick and sync in one tap (Jeff 2026-11-03). Android back = Later.
 * It comes back only when more changes get stuck than when it was dismissed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, compact, radius, spacing, typography, PayrollButton, Text } from '@jobcore/ui';

import { useSyncStatus } from '../lib/sync-status';
import { listStuck } from '../lib/offline-db';
import type { QueueRow } from '../lib/offline-db.types';
import { failureMessage, opLabel, savedAtLabel } from '../lib/sync-issues';

const SHOW_ROWS = 5;

export function StuckPopup() {
  const { isOnline, isSyncing, stuckCount, refresh, unstickAll } = useSyncStatus();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [busy, setBusy] = useState(false);
  const dismissedAtRef = useRef(0);

  // Show when more changes are stuck than when last dismissed; wait for a drain to settle first.
  useEffect(() => {
    if (stuckCount === 0) {
      dismissedAtRef.current = 0;
      setVisible(false);
      return;
    }
    if (!isOnline || isSyncing || pathname === '/sync-issues') return;
    if (stuckCount > dismissedAtRef.current) setVisible(true);
  }, [stuckCount, isOnline, isSyncing, pathname]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    listStuck(SHOW_ROWS)
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, stuckCount]);

  const dismiss = () => {
    dismissedAtRef.current = stuckCount;
    setVisible(false);
  };

  const onUnstick = async () => {
    setBusy(true);
    try {
      await unstickAll();
    } finally {
      setBusy(false);
    }
    dismissedAtRef.current = 0;
    setVisible(false);
  };

  const onSyncNow = () => {
    refresh();
    dismiss();
  };

  const onOpenIssues = () => {
    dismiss();
    router.push('/sync-issues');
  };

  const more = stuckCount - rows.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.overlay} onPress={dismiss}>
        <Pressable style={styles.card} onPress={() => {}} testID="stuck-popup">
          <View style={styles.accent} />
          <View style={styles.body}>
            <Text style={styles.heading} numberOfLines={1}>
              Changes are stuck
            </Text>
            <Text style={styles.summary}>
              {stuckCount === 1 ? '1 change is not sending.' : `${stuckCount} changes are not sending.`} Other
              jobs keep syncing.
            </Text>
            {rows.map((r) => (
              <View key={r.id} style={styles.row}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {opLabel(r.op)}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {savedAtLabel(r.occurred_at)}
                </Text>
                <Text style={styles.rowError} numberOfLines={4}>
                  {r.status === 'failed' || r.last_error ? failureMessage(r.last_error) : 'Retrying, not sent yet.'}
                </Text>
              </View>
            ))}
            {more > 0 ? <Text style={styles.rowMeta}>{`and ${more} more`}</Text> : null}
            <View style={styles.footer}>
              <PayrollButton
                label="Unstick and sync"
                accessibilityLabel="Unstick and sync"
                testID="stuck-popup-unstick"
                disabled={busy || !isOnline}
                onPress={() => void onUnstick()}
              />
              <PayrollButton
                label="Sync now"
                accessibilityLabel="Sync now"
                testID="stuck-popup-sync-now"
                disabled={busy || !isOnline}
                onPress={onSyncNow}
              />
              <PayrollButton
                label="Sync issues"
                accessibilityLabel="Sync issues"
                testID="stuck-popup-sync-issues"
                disabled={busy}
                onPress={onOpenIssues}
              />
              <PayrollButton
                label="Later"
                accessibilityLabel="Later"
                testID="stuck-popup-later"
                disabled={busy}
                onPress={dismiss}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    width: '90%',
    maxWidth: 420,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  accent: { width: 6, backgroundColor: colors.danger },
  body: { flex: 1, padding: spacing.md },
  heading: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.bold,
    fontSize: typography.text.title,
    color: colors.text,
  },
  summary: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.text.body,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: compact.section,
  },
  row: {
    paddingVertical: compact.field,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowTitle: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.medium,
    fontSize: typography.text.body,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.text.fieldLabel,
    color: colors.textMuted,
  },
  rowError: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.text.fieldLabel,
    color: colors.danger,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
