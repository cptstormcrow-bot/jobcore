// Screen hook: re-render when the read cache revision bumps (drain complete, patch, stale).
import { useSyncExternalStore } from 'react';
import { readCacheRevision } from '@jobcore/core';

export function useReadCacheRevision(): number {
  return useSyncExternalStore(readCacheRevision.subscribe, readCacheRevision.get, readCacheRevision.get);
}
