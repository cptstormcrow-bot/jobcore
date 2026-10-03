import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, ActivityIndicator, Pressable, StyleSheet, RefreshControl, Platform, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { ScreenTitle, colors, typography, spacing, radius, Text } from '@jobcore/ui';
import type { PremQueueItem } from '../data/ports';
import { premCardAction, premReportRoute, formatNeedsPremSince } from './prem-jobs-helpers';

export function PremJobs(): React.ReactElement {
  const session = getModuleSession();
  const [items, setItems] = useState<PremQueueItem[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const load = useCallback(
    (opts?: { isRefresh?: boolean }) => {
      if (session === null) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      if (opts?.isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const { premQueue: premQueueRepository } = getModulePorts();
      premQueueRepository
        .listOpen(session.userId)
        .then((result) => {
          if (cancelled) return;
          setItems(result.items);
          setUnavailable(result.unavailable);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load Prem queue.');
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          setRefreshing(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [session],
  );

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const hasFocusedOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      load();
    }, [load]),
  );

  const doClaim = useCallback(
    (item: PremQueueItem) => {
      if (session === null) return;
      setClaimingId(item.job.id);
      const { premQueue: premQueueRepository } = getModulePorts();
      premQueueRepository
        .claim(session.org.id, item.job.id, session.userId)
        .then(() => {
          load({ isRefresh: true });
        })
        .catch((err: unknown) => {
          const code = (err as { code?: string } | null)?.code;
          if (code === '23505') {
            setError('Already claimed by another tech');
            load();
          } else {
            setError(err instanceof Error ? err.message : 'Failed to claim job.');
          }
        })
        .finally(() => {
          setClaimingId(null);
        });
    },
    [session, load],
  );

  const handleClaim = useCallback(
    (item: PremQueueItem) => {
      if (session === null) return;
      const title = 'Claim Prem';
      const body = `Claim ${item.customerName ?? 'this job'} for a Prem?`;
      if (Platform.OS === 'web') {
        const confirmed = window.confirm(`${title}\n\n${body}`);
        if (!confirmed) return;
        doClaim(item);
      } else {
        Alert.alert(title, body, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes', onPress: () => doClaim(item) },
        ]);
      }
    },
    [session, doClaim],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (unavailable) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Prem queue not available yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} />}
      data={items}
      keyExtractor={(item) => item.job.id}
      ListHeaderComponent={
        <>
          <ScreenTitle title="Prems" />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No jobs need a Prem right now</Text>
        </View>
      }
      renderItem={({ item }) => {
        const since = formatNeedsPremSince(item.job.needsPremAt);
        return (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.customerName}>{item.customerName ?? 'Unknown customer'}</Text>
              <Text style={styles.address}>{item.job.address ?? ''}</Text>
              <Text style={styles.service}>{item.job.description ?? ''}</Text>
              {since ? <Text style={styles.since}>Needs Prem since {since}</Text> : null}
            </View>
            <Pressable
              style={styles.claimButton}
              disabled={claimingId === item.job.id}
              onPress={() => item.claimedByMe ? router.push(premReportRoute(item.job.id)) : handleClaim(item)}
            >
              <Text style={styles.claimButtonText}>{premCardAction(item.claimedByMe)}</Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.md ?? 16,
  },
  listContent: {
    paddingBottom: spacing.lg ?? 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: colors.textMuted,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm ?? 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowInfo: {
    flex: 1,
  },
  customerName: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: typography.size.label,
    lineHeight: 18,
    fontWeight: '600',
  },
  address: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    lineHeight: 17,
    color: colors.textMutedDark,
  },
  service: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    lineHeight: 17,
    color: colors.textMutedDark,
  },
  since: {
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  claimButton: {
    paddingHorizontal: spacing.md ?? 16,
    paddingVertical: spacing.sm ?? 8,
    borderRadius: radius.sm ?? 6,
    backgroundColor: colors.primary,
  },
  claimButtonText: {
    color: '#fff',
    fontSize: typography.size.label,
    fontWeight: '600',
  },
});
