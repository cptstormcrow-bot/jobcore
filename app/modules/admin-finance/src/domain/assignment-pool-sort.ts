/**
 * Pure ordering for the Assignment Board job pool.
 * sortPoolJobs orders by scheduledStart only (asc = earliest first, desc = latest first);
 * jobs with a missing/invalid scheduledStart go last in both directions.
 * unassignedFirst is a stable partition (unassigned ahead of assigned, order kept within each group). Both return NEW arrays; the input is never mutated.
 */

export type SortDirection = 'asc' | 'desc';

export interface PoolSortJob {
  scheduledStart?: string | null;
  createdAt?: string | null;
}

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** createdAt descending; missing values last. */
function byCreatedDesc(a: PoolSortJob, b: PoolSortJob): number {
  const ta = time(a.createdAt);
  const tb = time(b.createdAt);
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return tb - ta;
}

export function sortPoolJobs<T extends PoolSortJob>(
  jobs: readonly T[],
  direction: SortDirection,
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...jobs].sort((a, b) => {
    const ta = time(a.scheduledStart);
    const tb = time(b.scheduledStart);
    if (ta === null && tb !== null) return 1;
    if (ta !== null && tb === null) return -1;
    if (ta !== null && tb !== null && ta !== tb) return sign * (ta - tb);
    return byCreatedDesc(a, b);
  });
}

export function unassignedFirst<T>(jobs: readonly T[], isAssigned: (job: T) => boolean): T[] {
  const unassigned: T[] = [];
  const assigned: T[] = [];
  for (const j of jobs) (isAssigned(j) ? assigned : unassigned).push(j);
  return [...unassigned, ...assigned];
}
