// Turns anything a port or repo throws into a readable message. PostgREST errors are plain objects, not Error instances.
export function errorText(e: unknown, fallback = 'Something went wrong.'): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'string') return e || fallback;
  if (e && typeof e === 'object') {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}
