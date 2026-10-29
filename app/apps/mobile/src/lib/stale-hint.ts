/**
 * Pure (RN-free) helpers for the "Saved data" hint shown when a screen is
 * serving cached reads it could not refresh (offline or refresh failed).
 */

export interface StaleEntry {
  /** Cached query name (3rd read-cache key segment), e.g. 'app.jobs.byId'. */
  query: string;
  /** True when the cached copy was served and could not be confirmed fresh. */
  servingStale: boolean;
  /** Epoch ms the cached copy was fetched from the server. */
  cachedAt: number;
}

export interface StaleSummary {
  stale: boolean;
  /** Oldest cached-at among the matching stale entries; null when not stale. */
  cachedAt: number | null;
}

/** Entries whose query matches any prefix (empty/absent prefix list = all). */
export function summarizeStale(entries: readonly StaleEntry[], prefixes?: readonly string[]): StaleSummary {
  let oldest: number | null = null;
  for (const e of entries) {
    if (!e.servingStale) continue;
    if (prefixes && prefixes.length > 0 && !prefixes.some((p) => e.query.startsWith(p))) continue;
    if (oldest === null || e.cachedAt < oldest) oldest = e.cachedAt;
  }
  return { stale: oldest !== null, cachedAt: oldest };
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Plain-language hint, e.g. "Saved data · last updated 2:41 PM". Null when fresh. */
export function staleHintText(summary: StaleSummary, now: number = Date.now(), locale: string = 'en-US'): string | null {
  if (!summary.stale) return null;
  if (summary.cachedAt === null || !Number.isFinite(summary.cachedAt)) return 'Saved data · may be out of date';
  const at = new Date(summary.cachedAt);
  const time = at.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  if (sameLocalDay(at, new Date(now))) return `Saved data · last updated ${time}`;
  const day = at.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return `Saved data · last updated ${day}, ${time}`;
}
