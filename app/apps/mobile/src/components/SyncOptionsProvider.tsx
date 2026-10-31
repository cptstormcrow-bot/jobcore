import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { GlobalOptionsProvider, type MenuActionItem } from '@jobcore/ui';

import { useSession } from '../lib/session';
import { useSyncStatus } from '../lib/sync-status';

/*
 * Adds "Sync" to every screen's ⋮ menu (native, signed in only). The label is
 * bold red while any queued write has failed, plain text otherwise.
 */
export function SyncOptionsProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const { failedCount } = useSyncStatus();
  const router = useRouter();
  const show = session.status === 'authenticated' && Platform.OS !== 'web';

  const items = useMemo<MenuActionItem[]>(
    () =>
      show
        ? [
            {
              id: 'sync',
              label: 'Sync',
              tone: failedCount > 0 ? 'danger' : undefined,
              onPress: () => router.push('/sync-issues' as never),
            },
          ]
        : [],
    [show, failedCount, router],
  );

  return <GlobalOptionsProvider items={items}>{children}</GlobalOptionsProvider>;
}
