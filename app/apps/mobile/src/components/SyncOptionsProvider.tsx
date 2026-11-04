import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { GlobalOptionsProvider, type MenuActionItem } from '@jobcore/ui';

import { useSession } from '../lib/session';
import { useSyncStatus } from '../lib/sync-status';

/*
 * Adds "Sync" to every screen's ⋮ menu. Native (signed in): opens #0098 Sync
 * issues; the label is bold red while any queued write has failed. Web (owner
 * and admin only): opens #0101 Tech sync monitor, since web has no queue.
 */
export function SyncOptionsProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const { failedCount } = useSyncStatus();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const isAdmin =
    session.status === 'authenticated' && (session.profile.role === 'owner' || session.profile.role === 'admin');
  const show = session.status === 'authenticated' && (!isWeb || isAdmin);

  const items = useMemo<MenuActionItem[]>(
    () =>
      show
        ? [
            {
              id: 'sync',
              label: 'Sync',
              tone: !isWeb && failedCount > 0 ? 'danger' : undefined,
              onPress: () => router.push((isWeb ? '/sync-monitor' : '/sync-issues') as never),
            },
          ]
        : [],
    [show, isWeb, failedCount, router],
  );

  return <GlobalOptionsProvider items={items}>{children}</GlobalOptionsProvider>;
}
