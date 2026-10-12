// JobCore #0056 - pure helpers for the Add Blackout calendar (RN-free so the node test runner can load it)
import type { TimeOffRequestAdmin } from '../data/time-off-repo';

export const BLACKOUT_WEEK_VIEW_KEY = 'admin-finance.blackout.week-view';

export type CalMode = 'month' | 'week';

// Structural subset of the module-ports localPrefs port.
type LocalPrefsPort = {
  getBool(key: string, defaultValue: boolean): Promise<boolean>;
  setBool(key: string, value: boolean): Promise<void>;
};

export function modeFromPref(v: boolean | null | undefined): CalMode {
  return v === true ? 'week' : 'month';
}

export async function readCalMode(localPrefs: LocalPrefsPort | undefined | null): Promise<CalMode> {
  if (!localPrefs) return 'month';
  try {
    return modeFromPref(await localPrefs.getBool(BLACKOUT_WEEK_VIEW_KEY, false));
  } catch {
    return 'month';
  }
}

export async function writeCalMode(localPrefs: LocalPrefsPort | undefined | null, mode: CalMode): Promise<void> {
  if (!localPrefs) return;
  try {
    await localPrefs.setBool(BLACKOUT_WEEK_VIEW_KEY, mode === 'week');
  } catch {
    // preference is best-effort
  }
}

// Drops cancelled rows, optionally narrows to one tech, returns a new array sorted by startDate then createdAt.
export function filterTimeOffByTech(rows: TimeOffRequestAdmin[], techId: string | 'all'): TimeOffRequestAdmin[] {
  return rows
    .filter((r) => r.status !== 'cancelled' && (techId === 'all' || r.techId === techId))
    .slice()
    .sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
      if (a.createdAt === b.createdAt) return 0;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
}

export type BlackoutCalendarEvent = {
  id: string;
  title: string | null;
  description: string | null;
  eventTime: string;
  techId?: string;
  startDate: string;
  endDate: string;
};

// One event per active request; startDate/endDate carried so MonthView paints the whole span.
export function expandBlackoutsToEvents(rows: TimeOffRequestAdmin[]): BlackoutCalendarEvent[] {
  return rows
    .filter((r) => r.status === 'pending' || r.status === 'approved')
    .map((r) => ({
      id: r.id,
      title: 'Day Off',
      description: r.reason,
      eventTime: `${r.startDate}T12:00:00.000Z`,
      techId: r.techId,
      startDate: r.startDate,
      endDate: r.endDate,
    }));
}
