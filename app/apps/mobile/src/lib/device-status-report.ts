// Phone -> server sync-status report for the admin Tech sync monitor (#0101).
// Native only; device-status-report.web.ts is a no-op (web has no offline queue).
// Hard rule: a report never throws and never blocks a sync pass.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { countFailed, countPending, countStuck, listFailed } from './offline-db';
import { newClientId } from './ids';
import { getAppVersion } from './appVersion';

const DEVICE_ID_KEY = 'jobcore.device_id';
const MIN_GAP_MS = 15_000;

let cachedId: string | null = null;
let lastSentAt = 0;
let lastOnline: boolean | null = null;
let inflight = false;

async function deviceId(): Promise<string> {
  if (cachedId) return cachedId;
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = newClientId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  cachedId = id;
  return id;
}

function deviceName(): string {
  const c = Platform.constants as { Model?: string; Brand?: string; Manufacturer?: string } | undefined;
  const model = [c?.Brand ?? c?.Manufacturer, c?.Model].filter(Boolean).join(' ');
  const os = Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  return (model ? `${os} ${model}` : os).slice(0, 100);
}

/** Pulls a job id out of a queued payload, if it carries one. */
function jobIdOf(payload: string): string | null {
  try {
    const p = JSON.parse(payload) as Record<string, unknown>;
    const v = p.job_id ?? p.jobId;
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

/** Field names a queued payload tried to write (top level plus a nested patch), so a blocked save names its columns. */
function payloadKeysOf(payload: string): string[] {
  try {
    const p = JSON.parse(payload) as Record<string, unknown>;
    const keys = new Set(Object.keys(p));
    for (const nested of [p.patch, p.update, p.fields]) {
      if (nested && typeof nested === 'object') Object.keys(nested as object).forEach((k) => keys.add(k));
    }
    return [...keys].slice(0, 30);
  } catch {
    return [];
  }
}

/**
 * Sends this phone's queue counts to the server. Throttled to one send per
 * 15 seconds unless the online state changed. Offline phones skip the send;
 * the row's server-set last-seen time going stale is the signal.
 */
export async function reportDeviceStatus(isOnline: boolean, force = false): Promise<void> {
  if (Platform.OS === 'web') return;
  const now = Date.now();
  const changed = lastOnline !== isOnline;
  if (!isOnline) {
    lastOnline = false;
    return;
  }
  if (inflight) return;
  if (!force && !changed && now - lastSentAt < MIN_GAP_MS) return;
  inflight = true;
  try {
    const [pending, failed, stuck, rows] = await Promise.all([
      countPending(), countFailed(), countStuck(), listFailed(20),
    ]);
    const items = rows.map((r) => ({
      op: r.op,
      job_id: jobIdOf(r.payload),
      payload_keys: payloadKeysOf(r.payload),
      occurred_at: r.occurred_at,
      last_error: r.last_error ? r.last_error.slice(0, 300) : null,
    }));
    const { version, build } = getAppVersion();
    const { error } = await supabase.rpc('report_device_sync_status', {
      p_device_id: await deviceId(),
      p_device_name: deviceName(),
      p_app_version: (build ? `${version} (${build})` : version).slice(0, 40),
      p_is_online: isOnline,
      p_pending_count: pending,
      p_failed_count: failed,
      p_stuck_count: stuck,
      p_last_error: rows[0]?.last_error ? rows[0].last_error.slice(0, 1000) : null,
      p_failed_items: items,
    });
    if (!error) {
      lastSentAt = now;
      lastOnline = isOnline;
    }
  } catch {
    // Never surface: the monitor is advisory, the sync is not.
  } finally {
    inflight = false;
  }
}
