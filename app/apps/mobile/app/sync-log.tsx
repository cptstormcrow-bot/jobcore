// JobCore screen #0100 - sync-log - Sync history
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AppChrome, Card, PayrollButton, colors, spacing, typography, Text } from '@jobcore/ui';

import { clearSyncLog, discardStuck, listStuck, listSyncLog, retryStuck } from '../src/lib/offline-db';
import type { QueueRow, SyncLogRow } from '../src/lib/offline-db.types';
import { refetchAll } from '../src/lib/read-cache';
import { failureMessage, opLabel, savedAtLabel } from '../src/lib/sync-issues';
import { useSyncStatus } from '../src/lib/sync-status';

const KIND_LABEL: Record<SyncLogRow['kind'], string> = {
  sent: 'Sent',
  retry: 'Will retry',
  failed: 'Failed',
  pass: 'Sync pass',
  note: 'Saved, note',
};

export default function SyncLogScreen() {
  const { isSyncing, lastDrainAt } = useSyncStatus();
  const [rows, setRows] = useState<SyncLogRow[] | null>(null);
  const [stuck, setStuck] = useState<QueueRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStuck(await listStuck(50));
      setRows(await listSyncLog());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sync history.');
      setRows((prev) => prev ?? []);
    }
  }, []);

  // Reload after every drain so new lines show up while the screen is open.
  useEffect(() => {
    void load();
  }, [load, isSyncing, lastDrainAt]);

  const confirmClear = () => {
    Alert.alert('Clear sync history?', 'This only clears the history list. Queued changes are not touched.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            try {
              await clearSyncLog();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'That did not work. Please try again.');
            }
            await load();
          })(),
      },
    ]);
  };

  const retryOne = (row: QueueRow) =>
    void (async () => {
      try {
        await retryStuck(row.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That did not work. Please try again.');
      }
      await load();
    })();

  const confirmDiscard = (row: QueueRow) => {
    Alert.alert(
      'Discard this change?',
      `"${opLabel(row.op)}" saved ${savedAtLabel(row.occurred_at)} will be removed from this device and never sent. This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              try {
                await discardStuck(row.id);
                refetchAll();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'That did not work. Please try again.');
              }
              await load();
            })(),
        },
      ]
    );
  };

  const list = rows ?? [];

  return (
    <View style={styles.screen}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Sync history' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Sync history' }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {stuck.length > 0 ? (
          <Text style={styles.stuckHeading}>
            Stuck: {stuck.length} {stuck.length === 1 ? 'change is' : 'changes are'} not sending
          </Text>
        ) : null}
        {stuck.map((row) => (
          <Card key={row.id} style={[styles.card, styles.stuckCard]}>
            <Text style={styles.title} numberOfLines={2}>Stuck: {opLabel(row.op)}</Text>
            <Text style={styles.meta}>
              {savedAtLabel(row.occurred_at)} · tried {row.attempts} {row.attempts === 1 ? 'time' : 'times'}
            </Text>
            <Text style={styles.errorText}>{failureMessage(row.last_error)}</Text>
            <View style={styles.actionRow}>
              <PayrollButton label="Retry" onPress={() => retryOne(row)} />
              <PayrollButton label="Discard" onPress={() => confirmDiscard(row)} />
            </View>
          </Card>
        ))}
        {rows !== null && list.length === 0 ? (
          <Card>
            <Text style={styles.title}>No history yet</Text>
            <Text style={styles.meta}>Every send, retry and failure shows up here with its time.</Text>
          </Card>
        ) : null}
        {list.length > 0 ? (
          <View style={styles.topRow}>
            <Text style={styles.meta}>Newest first, last {list.length} entries.</Text>
            <PayrollButton label="Clear history" onPress={confirmClear} />
          </View>
        ) : null}
        {list.map((row) => (
          <Card key={row.id} style={styles.card}>
            <Text style={styles.title} numberOfLines={1}>
              {row.kind === 'pass' ? KIND_LABEL.pass : `${KIND_LABEL[row.kind]}: ${opLabel(row.op ?? '')}`}
            </Text>
            <Text style={styles.meta} numberOfLines={3}>
              {savedAtLabel(row.at)}
              {row.attempts && row.kind !== 'pass' ? ` · try ${row.attempts}` : ''}
            </Text>
            {(row.kind === 'pass' || row.kind === 'note') && row.message ? <Text style={styles.meta}>{row.message}</Text> : null}
            {row.kind === 'retry' || row.kind === 'failed' ? (
              <Text style={styles.errorText}>{failureMessage(row.message)}</Text>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.md, gap: spacing.sm },
  card: { gap: spacing.xs },
  stuckHeading: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.danger },
  stuckCard: { borderWidth: 2, borderColor: colors.danger },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  topRow: { gap: spacing.xs, marginBottom: spacing.xs },
  title: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.text },
  meta: { fontSize: typography.size.small, color: colors.textMuted },
  errorText: { fontSize: typography.size.small, color: colors.danger },
});
