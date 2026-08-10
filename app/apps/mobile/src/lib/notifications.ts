/**
 * Push-notification scaffolding (P7 Slice B).
 *
 * Client-side only: requests OS permission, reads the Expo push token, and
 * persists per-event-type notification preferences in SecureStore. Deliberately
 * OUT of scope (per the plan): no server-side send, no device-token server
 * registration/upload, no crash/error-reporting SDK. `getExpoPushToken` is a
 * thin wrapper the future server-registration step will call — it does not
 * upload anything itself.
 */

import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { logSyncFailure } from './log';

/** The finite set of job/app events a user can independently opt in/out of. */
export type NotificationEventType =
  | 'job.assigned'
  | 'job.reschedule_requested'
  | 'job.status_changed'
  | 'payroll.period_closed'
  | 'audit.skew_detected';

export type NotificationPreferences = Record<NotificationEventType, boolean>;

const ALL_EVENT_TYPES: readonly NotificationEventType[] = [
  'job.assigned',
  'job.reschedule_requested',
  'job.status_changed',
  'payroll.period_closed',
  'audit.skew_detected',
];

/** Default preferences: every event type opted in until the user says otherwise. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  'job.assigned': true,
  'job.reschedule_requested': true,
  'job.status_changed': true,
  'payroll.period_closed': true,
  'audit.skew_detected': true,
};

const PREFERENCES_KEY = 'jobcore.notification_preferences';
const PUSH_TOKEN_KEY = 'jobcore.expo_push_token';

/**
 * Requests OS notification permission if not already granted.
 * Returns the resulting permission status; never throws — a denial is a
 * normal, expected outcome, not a failure worth crashing over.
 */
export async function requestNotificationPermission(): Promise<Notifications.PermissionStatus> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') {
      return existing.status;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status;
  } catch (error) {
    logSyncFailure('notifications', 'Failed to request notification permission', error);
    return 'undetermined' as Notifications.PermissionStatus;
  }
}

/**
 * Reads the device's Expo push token, if permission has been granted.
 * Returns `null` on any failure (denied permission, no physical device,
 * missing project id) rather than throwing — callers treat "no token" as a
 * normal state, not an error.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') {
      return null;
    }
    const result = await Notifications.getExpoPushTokenAsync();
    return result.data;
  } catch (error) {
    logSyncFailure('notifications', 'Failed to read Expo push token', error);
    return null;
  }
}

/** Persists the device's push token locally (SecureStore). Does not upload it anywhere. */
export async function setStoredPushToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  } catch (error) {
    logSyncFailure('notifications', 'Failed to persist push token', error);
  }
}

/** Reads the last locally-persisted push token, if any. */
export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch (error) {
    logSyncFailure('notifications', 'Failed to read stored push token', error);
    return null;
  }
}

/** Reads persisted per-event-type notification preferences, falling back to all-on defaults. */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await SecureStore.getItemAsync(PREFERENCES_KEY);
    if (!raw) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    for (const eventType of ALL_EVENT_TYPES) {
      if (typeof parsed[eventType] === 'boolean') {
        merged[eventType] = parsed[eventType] as boolean;
      }
    }
    return merged;
  } catch (error) {
    logSyncFailure('notifications', 'Failed to read notification preferences', error);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/** Persists per-event-type notification preferences. */
export async function setNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    logSyncFailure('notifications', 'Failed to persist notification preferences', error);
  }
}

export { ALL_EVENT_TYPES as NOTIFICATION_EVENT_TYPES };
