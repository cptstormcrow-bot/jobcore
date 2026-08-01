import React from 'react';
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@jobcore/ui';

import { useSyncStatus } from '../lib/sync-status';

/*
 * This component is app-connected: it consumes `useSyncStatus()`, a React
 * context provided by the app (`SyncStatusProvider`, defined in
 * `apps/mobile/src/lib/sync-status.tsx`). That's why it lives here in
 * `apps/mobile/src/components/` rather than in `packages/ui` — `packages/ui`
 * holds only context-free presentational primitives.
 */

export interface SyncIndicatorProps {
  style?: StyleProp<ViewStyle>;
}

export function SyncIndicator({ style }: SyncIndicatorProps) {
  const { pendingCount, syncing, lastError, refresh } = useSyncStatus();

  if (pendingCount === 0 && !syncing && !lastError) {
    return null;
  }

  let label: string;
  let labelColor: string;

  if (lastError) {
    label = 'Sync failed — tap to retry';
    labelColor = colors.danger;
  } else if (syncing) {
    label = 'Syncing…';
    labelColor = colors.textMuted;
  } else {
    label = `${pendingCount} pending`;
    labelColor = colors.warning;
  }

  return (
    <Pressable style={[styles.container, style]} onPress={refresh}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
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
