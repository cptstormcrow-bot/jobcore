// JobCore screen #0049 - sm-CallbackTasks - Callback tasks
/**
 * CallbackTasks — sales callback task list (P6, Workstream J: "Sales
 * callback task from completed jobs").
 *
 * Consumes `CallbackTaskRepository` (`../data/ports.ts` via
 * `getModulePorts().callbackTasks`). `listOpen` returns only completed jobs
 * where `called_back_at is null` (no `sales_callback_status` row, or one
 * with a null timestamp) — this screen renders exactly what the port
 * returns and applies no further client-side filtering, matching
 * `ReviewLibrary`'s precedent of leaning on server-side scoping.
 *
 * "Mark Called Back" is the only write this screen performs: it calls
 * `markCalledBack(jobId, organizationId, calledBackBy, calledBackAt)` with
 * the current session's `userId` and `new Date().toISOString()`, then
 * removes the task from the visible list on success (it no longer matches
 * `listOpen`'s "open" definition).
 */

import * as React from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { isBetaVisible } from '@jobcore/core';
import { ScreenTitle, Toggle, Button, colors, Text } from '@jobcore/ui';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';
import type { CallbackTask } from '../data/ports';

export function CallbackTasks(): React.ReactElement {
  const session = useModuleSession();

  const [tasks, setTasks] = React.useState<CallbackTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [markingIds, setMarkingIds] = React.useState<ReadonlySet<string>>(new Set());
  const [markError, setMarkError] = React.useState<string | null>(null);
  const [showBeta, setShowBeta] = React.useState(false);

  const load = React.useCallback(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getModulePorts()
      .callbackTasks.listOpen(session.org.id)
      .then((result) => {
        setTasks(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load callback tasks.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleMarkCalledBack = React.useCallback(
    (task: CallbackTask) => {
      if (session === null || markingIds.has(task.jobId)) {
        return;
      }
      setMarkError(null);
      setMarkingIds((prev) => new Set(prev).add(task.jobId));

      getModulePorts()
        .callbackTasks.markCalledBack(task.jobId, session.org.id, session.userId, new Date().toISOString())
        .then(() => {
          setTasks((prev) => prev.filter((t) => t.jobId !== task.jobId));
        })
        .catch((err: unknown) => {
          setMarkError(err instanceof Error ? err.message : 'Failed to mark job called back.');
        })
        .finally(() => {
          setMarkingIds((prev) => {
            const next = new Set(prev);
            next.delete(task.jobId);
            return next;
          });
        });
    },
    [session, markingIds],
  );

  if (session === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenTitle title="Callback Tasks" />

      <Toggle label="Show Test Jobs" value={showBeta} onChange={setShowBeta} />

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      )}

      {!loading && error !== null && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {markError !== null && <Text style={styles.errorText}>{markError}</Text>}

      {!loading && error === null && tasks.filter((task) => isBetaVisible(task, showBeta)).length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No open callback tasks.</Text>
        </View>
      )}

      {!loading && error === null && tasks.filter((task) => isBetaVisible(task, showBeta)).length > 0 && (
        <FlatList
          data={tasks.filter((task) => isBetaVisible(task, showBeta))}
          keyExtractor={(task) => task.jobId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.customerName}>{item.customerName ?? 'Unknown customer'}</Text>
              {item.customerPhone !== null && <Text style={styles.meta}>{item.customerPhone}</Text>}
              {item.address !== null && <Text style={styles.meta}>{item.address}</Text>}
              <Text style={styles.meta}>Completed {item.completedAt ?? 'unknown date'}</Text>
              {item.deferredTaskTitles !== undefined && item.deferredTaskTitles.length > 0 && (
                <Text style={styles.meta}>Next project ideas: {item.deferredTaskTitles.join(', ')}</Text>
              )}
              {item.hasOpenJob === true ? (
                <Text style={styles.meta}>
                  Open job{item.openJobNumber != null ? ` #${item.openJobNumber}` : ''} in progress
                </Text>
              ) : (
              <Button
                label={markingIds.has(item.jobId) ? 'Marking…' : 'Mark Called Back'}
                disabled={markingIds.has(item.jobId)}
                onPress={() => handleMarkCalledBack(item)}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: {
    color: colors.textMutedDark,
  },
  errorText: {
    color: colors.danger,
  },
  listContent: {
    paddingBottom: 16,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: colors.textMutedDark,
    marginTop: 2,
  },
});

export default CallbackTasks;
