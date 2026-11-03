// RN-free helper: retry a send once after refreshing the auth session.
// The refresh happens at most once per drain pass (one guard per wrapper
// instance), so a dead refresh token cannot hammer the auth endpoint.
// Rows sent at the same time share that one refresh: each row that hits an
// auth error waits for it and then retries once. If a retry still fails auth,
// the fresh session is no good either and later rows throw without retrying.

export interface AuthRetryDeps<R> {
  send: (row: R) => Promise<void>;
  /** True when the error is an auth/401/JWT-expired failure. */
  isAuthError: (e: unknown) => boolean;
  /** Returns true when a fresh session is now available. */
  refresh: () => Promise<boolean>;
}

export function makeAuthRetrySend<R>(deps: AuthRetryDeps<R>): (row: R) => Promise<void> {
  let refreshing: Promise<boolean> | null = null;
  let dead = false;
  return async (row: R) => {
    try {
      await deps.send(row);
    } catch (e) {
      if (!deps.isAuthError(e) || dead) throw e;
      refreshing ??= deps.refresh().catch(() => false);
      if (!(await refreshing)) throw e;
      // Retry once; a second failure propagates and counts as the row's attempt.
      try {
        await deps.send(row);
      } catch (e2) {
        if (deps.isAuthError(e2)) dead = true;
        throw e2;
      }
    }
  };
}
