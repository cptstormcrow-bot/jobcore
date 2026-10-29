// Background sync: periodically drains the offline outbox while the app is
// backgrounded or closed (Android WorkManager via expo-background-fetch).
// Native only. The task is defined at module top level (required by
// expo-task-manager) and registered/unregistered as the auth session changes.
// Reuses drainOfflineQueue, which already coalesces concurrent drains, so a
// foreground and a background drain cannot overlap in the same JS runtime.

import { Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import { countPending, drainOfflineQueue } from './offline-db';

export const BACKGROUND_SYNC_TASK = 'jobcore-background-sync';
const MIN_INTERVAL_SECONDS = 15 * 60;

if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      if ((await countPending()) === 0) return BackgroundFetch.BackgroundFetchResult.NoData;
      const r = await drainOfflineQueue();
      if (r.sent > 0) return BackgroundFetch.BackgroundFetchResult.NewData;
      if (r.aborted === 'network' || r.aborted === 'auth' || r.aborted === 'unknown') {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
      return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  const register = async () => {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      if (status !== BackgroundFetch.BackgroundFetchStatus.Available) return;
      if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) return;
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: MIN_INTERVAL_SECONDS,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch {
      // Background sync is best-effort; foreground drain still works.
    }
  };

  const unregister = async () => {
    try {
      if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK)) {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      }
    } catch {
      // ignore
    }
  };

  // Register once signed in; unregister on sign-out so a signed-out device
  // does not wake the app for nothing.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) void unregister();
    else void register();
  });
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) void register();
  });
}
