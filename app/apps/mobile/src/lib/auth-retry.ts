// RN-free helper: retry a send once after refreshing the auth session.
// The refresh happens at most once per drain pass (one guard per wrapper
// instance), so a dead refresh token cannot hammer the auth endpoint.

export interface AuthRetryDeps<R> {
  send: (row: R) => Promise<void>;
  /** True when the error is an auth/401/JWT-expired failure. */
  isAuthError: (e: unknown) => boolean;
  /** Returns true when a fresh session is now available. */
  refresh: () => Promise<boolean>;
}

export function makeAuthRetrySend<R>(deps: AuthRetryDeps<R>): (row: R) => Promise<void> {
  let refreshed = false;
  return async (row: R) => {
    try {
      await deps.send(row);
    } catch (e) {
      if (!deps.isAuthError(e) || refreshed) throw e;
      refreshed = true;
      let ok = false;
      try {
        ok = await deps.refresh();
      } catch {
        ok = false;
      }
      if (!ok) throw e;
      // Retry once; a second failure propagates and counts as the row's attempt.
      await deps.send(row);
    }
  };
}
