// What warm-cache fills, and how often. No Expo or React Native imports, so the node test runner can load it.

export interface WarmRange {
  from: string;
  to: string;
}

/** Only these roles open #0088 Payroll (admin), #0087 Payroll Run and #0065 Settings. */
export const WARM_ROLES: readonly string[] = ['owner', 'admin'];

/** At most one fill per this long, however often the phone reconnects or comes to the front. */
export const WARM_EVERY_MS = 10 * 60_000;

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The same pay week #0088 Payroll (admin) shows: TimesheetApprovalPanel's weekRange. */
export function payWeekRange(now: Date, weekStartDow: number, offsetWeeks: number): WarmRange {
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = new Date(todayMs).getUTCDay();
  const back = (dow - weekStartDow + 7) % 7;
  const startMs = todayMs - back * 86_400_000 + offsetWeeks * 7 * 86_400_000;
  return { from: toIso(startMs), to: toIso(startMs + 6 * 86_400_000) };
}

/** This pay week and last pay week: the ones looked at most. */
export function warmRanges(now: Date, weekStartDow: number): WarmRange[] {
  return [payWeekRange(now, weekStartDow, 0), payWeekRange(now, weekStartDow, -1)];
}

/** Returns true when a fill may run now, and starts the wait for the next one. */
export function makeWarmGate(everyMs: number = WARM_EVERY_MS, clock: () => number = Date.now): () => boolean {
  let last = -Infinity;
  return () => {
    const now = clock();
    if (now - last < everyMs) return false;
    last = now;
    return true;
  };
}
