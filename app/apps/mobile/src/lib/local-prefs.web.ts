// Small, generic durable boolean-preference storage for the mobile app.
// Web implementation — backed by window.localStorage, which survives page
// reloads and browser restarts. Metro resolves this file on web (via the
// `.web.ts` filename suffix) and local-prefs.ts on native — same
// platform-split pattern as offline-db.ts / offline-db.web.ts.

/** Reads a stored boolean preference, falling back to `defaultValue` if unset. */
export async function getBoolPref(key: string, defaultValue: boolean): Promise<boolean> {
  if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
  const value = window.localStorage.getItem(key);
  if (value === null) return defaultValue;
  return value === 'true';
}

/** Persists a boolean preference. Survives page reloads and logout/login. */
export async function setBoolPref(key: string, value: boolean): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(key, value ? 'true' : 'false');
}
