// When a screen asks for data that was never saved on this phone, decide whether
// to try the internet. Known offline, the try can only fail, and it fails slowly:
// the sign-in token refresh and the request timeout both wait before giving up.
// No Expo or React Native imports, so the node test runner can load it.

/** The error a dropped connection gives, so callers fall back the same way. */
export function offlineMissError(): TypeError {
  return new TypeError('Network request failed');
}

/** True when a read with no saved copy should fail at once instead of fetching. */
export function skipFetchWhenNoCopy(online: boolean): boolean {
  return !online;
}
