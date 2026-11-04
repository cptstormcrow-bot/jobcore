// A fetch that gives up. On a weak signal the phone can show connected while no data
// gets through, and a plain fetch then waits forever: the sync pass never finishes, so
// no later pass runs, and a change being sent stays "sending" until the app restarts.
// No Expo or React Native imports, so the node test runner can load it.

type Fetch = typeof fetch;

/** Normal requests give up after this long. */
export const REQUEST_TIMEOUT_MS = 30_000;
/** Photo uploads and downloads get longer, since a big photo on a weak signal is slow but still moving. */
export const STORAGE_TIMEOUT_MS = 120_000;

function urlOf(input: Parameters<Fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && 'url' in input) return String((input as { url: unknown }).url);
  return String(input);
}

export function timeoutFor(url: string): number {
  return url.includes('/storage/v1/') ? STORAGE_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
}

/**
 * Wraps `base` so every request is cut off after its timeout. A cut-off request fails
 * the same way a dropped connection does (a TypeError), so the queue retries it later.
 * A caller's own abort signal still works and still reports as the caller's abort.
 */
export function makeTimedFetch(base: Fetch, timeout: (url: string) => number = timeoutFor): Fetch {
  return (async (input: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const ctl = new AbortController();
    const outer = init?.signal ?? undefined;
    const onOuterAbort = (): void => ctl.abort();
    if (outer) {
      if (outer.aborted) ctl.abort();
      else outer.addEventListener('abort', onOuterAbort);
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, timeout(urlOf(input)));
    try {
      return await base(input, { ...init, signal: ctl.signal });
    } catch (e) {
      if (timedOut && !outer?.aborted) throw new TypeError('Network request timed out');
      throw e;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    }
  }) as Fetch;
}
