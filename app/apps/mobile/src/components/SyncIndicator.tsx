import React from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, Text } from '@jobcore/ui';

import { useSyncStatus } from '../lib/sync-status';

/*
 * App-connected floating badge (bottom-left; ScreenNumberBadge is bottom-right
 * with the same bottom offset). Renders nothing when idle, online, and clean.
 */

export interface SyncIndicatorProps {
  style?: StyleProp<ViewStyle>;
}

export function SyncIndicator({ style }: SyncIndicatorProps) {
  const { isOnline, pendingCount, failedCount, isSyncing, retryAll } = useSyncStatus();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Online, the badge stays out of the way: changes still waiting are retried
  // quietly in the background. It shows only offline, while syncing, or when a
  // change really failed and needs a fix (Jeff 2026-11-02).
  const failed = failedCount > 0 && isOnline && !isSyncing;
  if (isOnline && !isSyncing && !failed) return null;

  let label: string;
  let labelColor: string = colors.textMuted;
  let tappable = true;

  if (!isOnline) {
    label = `Offline · ${pendingCount} saved`;
    tappable = failedCount > 0;
  } else if (isSyncing) {
    label = 'Syncing…';
    tappable = false;
  } else {
    label = `${failedCount} failed`;
    labelColor = colors.danger;
  }

  return (
    <Pressable
      disabled={!tappable}
      onPress={() => {
        if (pathname !== '/sync-issues') router.push('/sync-issues' as never);
        else void retryAll();
      }}
      style={[styles.container, { bottom: spacing.sm + insets.bottom }, style]}
    >
      <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.sm,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: spacing.sm,
  },
  label: {
    fontSize: typography.size.small,
    fontWeight: typography.weight.medium,
  },
});
