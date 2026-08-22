// Web-platform stub for the device-local offline mutation queue.
// expo-sqlite has no web implementation and throws at import time on web,
// so this file (picked automatically by Metro's platform-extension
// resolution on web) provides no-op stand-ins with the same exported
// shape as offline-db.ts. The web build has no offline queue.

import type {
  QueuedMutation,
  NewQueuedMutation,
  ReplayResult,
} from '@jobcore/core';

export const OFFLINE_DB_NAME = 'jobcore-offline.db';

export async function getOfflineDb(): Promise<null> {
  return null;
}

export async function countPending(): Promise<number> {
  return 0;
}

export async function enqueue(_mutation: NewQueuedMutation): Promise<void> {
  // No-op on web: there is no offline queue to persist to.
}

export async function listPending(): Promise<QueuedMutation[]> {
  return [];
}

export async function markDone(_id: string): Promise<void> {
  // No-op on web.
}

export async function markFailed(_id: string): Promise<void> {
  // No-op on web.
}

export async function replayPending(
  _send: (mutation: QueuedMutation) => Promise<void>
): Promise<ReplayResult> {
  return { sent: 0, failed: 0 };
}
