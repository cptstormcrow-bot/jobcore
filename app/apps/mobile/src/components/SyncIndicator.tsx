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
  const { isOnline, pendingCount, failedCount, isSyncing, lastError, refresh, retryAll } = useSyncStatus();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const failed = (failedCount > 0 || !!lastError) && isOnline && !isSyncing;
  if (isOnline && !isSyncing && pendingCount === 0 && !failed) return null;

  let label: string;
  let labelColor: string = colors.textMuted;
  let tappable = true;

  if (!isOnline) {
    label = `Offline · ${pendingCount} saved`;
    tappable = failedCount > 0;
  } else if (isSyncing) {
    label = 'Syncing…';
    tappable = false;
  } else if (failed) {
    // No failed rows but a paused drain: say so instead of a phantom "1 failed".
    label = failedCount > 0 ? `${failedCount} failed` : 'Sync paused · tap to retry';
    labelColor = colors.danger;
  } else {
    label = `${pendingCount} to sync`;
    labelColor = colors.warning;
  }

  return (
    <Pressable
      disabled={!tappable}
      onPress={() => {
        if (failedCount > 0 && pathname !== '/sync-issues') router.push('/sync-issues' as never);
        else if (failedCount > 0) void retryAll();
        else refresh();
      }}
      style={[styles.container, { bottom: spacing.sm + insets.bottom }, style]}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
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
