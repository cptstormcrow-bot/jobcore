// Tiny module-level event bus for the offline sync engine. No React.

export interface DrainCompleteEvent {
  sent: number;
  failed: number;
  retried: number;
  pendingAfter: number;
  at: string;
  ops: string[];
}

const drainListeners = new Set<(e: DrainCompleteEvent) => void>();

export function subscribeDrainComplete(cb: (e: DrainCompleteEvent) => void): () => void {
  drainListeners.add(cb);
  return () => {
    drainListeners.delete(cb);
  };
}

export function emitDrainComplete(e: DrainCompleteEvent): void {
  for (const cb of Array.from(drainListeners)) {
    try {
      cb(e);
    } catch {
      // a listener must never break the drain
    }
  }
}

let onlineNow = true;
// False until the first network report after launch; until then onlineNow is only a guess.
let netKnown = false;
const netWaiters = new Set<() => void>();

export function isOnlineNow(): boolean {
  return onlineNow;
}

export function setOnlineNow(v: boolean): void {
  onlineNow = v;
  netKnown = true;
  for (const w of Array.from(netWaiters)) w();
}

export function isNetKnown(): boolean {
  return netKnown;
}

/** Resolves on the first network report, or after maxMs, whichever comes first. */
export function whenNetKnown(maxMs: number): Promise<void> {
  if (netKnown) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(t); netWaiters.delete(done); resolve(); };
    const t = setTimeout(done, maxMs);
    netWaiters.add(done);
  });
}

let drainRequester: (() => void) | null = null;
let drainTimer: ReturnType<typeof setTimeout> | null = null;

export function registerDrainRequester(fn: (() => void) | null): void {
  drainRequester = fn;
}

/** Debounced (500 ms), coalescing request to drain. No-op if no requester registered. */
export function requestDrain(): void {
  if (!drainRequester) return;
  if (drainTimer) return;
  drainTimer = setTimeout(() => {
    drainTimer = null;
    drainRequester?.();
  }, 500);
}
