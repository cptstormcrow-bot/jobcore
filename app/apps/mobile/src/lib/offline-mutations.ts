import './offline-ops/register';
import { Platform } from 'react-native';
import { classifyReplayError } from '@jobcore/core';
import { countPending, enqueue, markDone, markFailed, markInflight, markRetry, send } from './offline-db';
import { UnknownOpError } from './offline-ops';
import { newClientId } from './ids';
import { patchReadCache } from './read-cache';
import { isOnlineNow, requestDrain } from './sync-events';

export const QUEUED_COPY = 'Saved on this device — will sync when back online';

export class OfflineError extends Error {
  readonly offline = true;
  constructor(message: string) {
    super(message);
    this.name = 'OfflineError';
  }
}

export function requireOnline(label: string): void {
  if (!isOnlineNow()) throw new OfflineError(`Needs internet to ${label}.`);
}

export function toUserMessage(x: unknown): string {
  if (x instanceof OfflineError) return x.message;
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object' && typeof (x as { message?: unknown }).message === 'string') {
    const e = x as { message: string; code?: unknown; details?: unknown; detail?: unknown };
    if (e.message.includes('customer_has_open_job') || e.code === 'customer_has_open_job') {
      const d = [e.details, e.detail, e.message].filter((v): v is string => typeof v === 'string').join(' ');
      const m = /job_number\D{0,5}(\d+)/i.exec(d) ?? /#(\d+)/.exec(d);
      return m ? `Customer already has open Job #${m[1]}` : 'Customer already has an open job';
    }
    return e.message;
  }
  return 'Something went wrong.';
}

function msgOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function writeThrough<T>(
  op: string,
  payload: Record<string, unknown> & { id?: string },
  occurredAt: string,
  optimistic: T
): Promise<{ status: 'applied' | 'queued'; data: T }> {
  // Web has no SQLite queue: send directly, surface any error.
  if (Platform.OS === 'web') {
    await send({ op, payload: JSON.stringify(payload) });
    return { status: 'applied', data: optimistic };
  }

  const id = payload.id ?? newClientId();
  const wasEmpty = (await countPending()) === 0;
  await enqueue({ id, op, payload: JSON.stringify(payload), occurredAt });

  const queued = async (): Promise<{ status: 'queued'; data: T }> => {
    requestDrain();
    await patchReadCache(op, payload);
    return { status: 'queued', data: optimistic };
  };

  if (!wasEmpty) return queued();
  if (!isOnlineNow()) {
    await patchReadCache(op, payload);
    return { status: 'queued', data: optimistic };
  }

  await markInflight(id);
  try {
    await send({ op, payload: JSON.stringify(payload) });
    await markDone(id);
    return { status: 'applied', data: optimistic };
  } catch (err) {
    const cls = err instanceof UnknownOpError ? 'permanent' : classifyReplayError(err);
    if (cls === 'duplicate') {
      await markDone(id);
      return { status: 'applied', data: optimistic };
    }
    if (cls === 'network' || cls === 'auth' || cls === 'unknown') {
      await markRetry(id, { errorClass: cls, message: msgOf(err), nextAttemptAt: new Date().toISOString() });
      return queued();
    }
    await markFailed(id, { errorClass: cls, message: msgOf(err) });
    throw err;
  }
}
