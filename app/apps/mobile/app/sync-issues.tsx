// JobCore screen - sync-issues - Sync issues (writes that could not be sent)
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AppChrome, Card, PayrollButton, colors, spacing, typography, Text } from '@jobcore/ui';

import { discardFailed, listAllFailed, retryAllFailed, retryFailed } from '../src/lib/offline-db';
import type { QueueRow } from '../src/lib/offline-db.types';
import { refetchAll } from '../src/lib/read-cache';
import { failureMessage, opLabel, savedAtLabel } from '../src/lib/sync-issues';
import { useSyncStatus } from '../src/lib/sync-status';

export default function SyncIssuesScreen() {
  const { refresh, failedCount } = useSyncStatus();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listAllFailed());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sync issues.');
      setRows((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, failedCount]);

  const run = useCallback(
    async (action: () => Promise<void>, afterCacheRefresh = false) => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That did not work. Please try again.');
      }
      if (afterCacheRefresh) refetchAll();
      refresh(); // recount badge + trigger a drain
      await load();
    },
    [refresh, load]
  );

  const confirmDiscard = (row: QueueRow) => {
    Alert.alert(
      `Discard this ${opLabel(row.op).toLowerCase()}?`,
      'It was saved on this device but never reached the server. Discarding deletes it for good.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => void run(() => discardFailed(row.id), true) },
      ]
    );
  };

  const list = rows ?? [];

  return (
    <View style={styles.screen}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Sync issues' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Sync issues' }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {rows !== null && list.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.meta}>Nothing is waiting on a fix. Every change saved on this device has been sent.</Text>
          </Card>
        ) : null}
        {list.length > 0 ? (
          <View style={styles.topRow}>
            <Text style={styles.meta}>
              {list.length} {list.length === 1 ? 'change' : 'changes'} could not be sent.
            </Text>
            <PayrollButton label="Retry all" onPress={() => void run(retryAllFailed)} />
          </View>
        ) : null}
        {list.map((row) => (
          <Card key={row.id} style={styles.card}>
            <Text style={styles.title}>{opLabel(row.op)}</Text>
            <Text style={styles.meta}>{savedAtLabel(row.occurred_at)}</Text>
            <Text style={styles.errorText}>{failureMessage(row.last_error)}</Text>
            <View style={styles.actions}>
              <PayrollButton label="Retry" onPress={() => void run(() => retryFailed(row.id))} />
              <PayrollButton label="Discard" onPress={() => confirmDiscard(row)} />
            </View>
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
  topRow: { gap: spacing.xs, marginBottom: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  title: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.text },
  emptyTitle: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.text },
  meta: { fontSize: typography.size.small, color: colors.textMuted },
  errorText: { fontSize: typography.size.small, color: colors.danger },
  error: { fontSize: typography.size.small, color: colors.danger },
});
