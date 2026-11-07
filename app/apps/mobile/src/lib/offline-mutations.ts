import './offline-ops/register';
import { Platform } from 'react-native';
import { classifyReplayError } from '@jobcore/core';
import { countPending, enqueue, listOpen, markDone, markFailed, markRetry, send } from './offline-db';
import { UnknownOpError } from './offline-ops';
import { newClientId } from './ids';
import { getReadCacheIdentity, patchReadCache } from './read-cache';
import { canSendInline, makeLock } from './queue-order';
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
  return toUserMessage(err);
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
    await patchReadCache(op, payload);
    return { status: 'applied', data: optimistic };
  }

  // Queue row id is always fresh: payload.id is the record id, and two writes
  // to one record (create then note, or two edits) must not collide.
  // The check and the insert run under one lock: two quick saves (a double tap, or
  // assign then note) could both see an empty queue and race each other to the server.
  // An inline row goes in already inflight, so a drain starting now can't send it too.
  const id = newClientId();
  const wasEmpty = await queueLock(async () => {
    const userId = getReadCacheIdentity()?.userId ?? null;
    const body = JSON.stringify(payload);
    // Only changes to the same records make this one wait; an unrelated stuck row must not.
    const empty = isOnlineNow() && canSendInline(await listOpen(), { op, payload: body, user_id: userId });
    await enqueue({ id, op, payload: body, occurredAt }, { inflight: empty, userId });
    return empty;
  });

  const queued = async (): Promise<{ status: 'queued'; data: T }> => {
    requestDrain();
    await patchReadCache(op, payload);
    return { status: 'queued', data: optimistic };
  };

  if (!wasEmpty) {
    if (!isOnlineNow()) {
      await patchReadCache(op, payload);
      return { status: 'queued', data: optimistic };
    }
    return queued();
  }

  const sending = send({ op, payload: JSON.stringify(payload) });
  const settled = sending.then(
    () => ({ ok: true as const }),
    (err: unknown) => ({ ok: false as const, err }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), INLINE_SEND_MS);
  });
  const result = await Promise.race([settled, timedOut]);
  clearTimeout(timer);

  if (result === null) {
    // A slow send (a big photo upload on a weak signal) must not hold the screen.
    // The row stays inflight; the send settles it in the background.
    void settled.then(async (r) => {
      if (r.ok) {
        await markDone(id);
        await patchReadCache(op, payload);
      } else {
        await settleFailedSend(id, r.err);
      }
      requestDrain();
    });
    await patchReadCache(op, payload);
    return { status: 'queued', data: optimistic };
  }

  if (result.ok) {
    await markDone(id);
    await patchReadCache(op, payload);
    await drainIfWaiting();
    return { status: 'applied', data: optimistic };
  }
  const outcome = await settleFailedSend(id, result.err);
  if (outcome === 'retry') return queued();
  await drainIfWaiting();
  if (outcome === 'duplicate') return { status: 'applied', data: optimistic };
  throw result.err;
}

const queueLock = makeLock();

// Changes saved while this one was sending were held behind it; send them now.
async function drainIfWaiting(): Promise<void> {
  if ((await countPending()) > 0) requestDrain();
}

// Inline sends longer than this hand off to the queue so the caller is never stuck.
const INLINE_SEND_MS = 15000;

async function settleFailedSend(id: string, err: unknown): Promise<'duplicate' | 'retry' | 'failed'> {
  const cls = err instanceof UnknownOpError ? 'permanent' : classifyReplayError(err);
  if (cls === 'duplicate') {
    await markDone(id);
    return 'duplicate';
  }
  if (cls === 'network' || cls === 'auth' || cls === 'unknown') {
    await markRetry(id, { errorClass: cls, message: msgOf(err), nextAttemptAt: new Date().toISOString() });
    return 'retry';
  }
  await markFailed(id, { errorClass: cls, message: msgOf(err) });
  return 'failed';
}
