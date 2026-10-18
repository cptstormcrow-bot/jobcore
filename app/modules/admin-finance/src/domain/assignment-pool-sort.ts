/**
 * Pure ordering for the Assignment Board job pool.
 * Unassigned jobs first, assigned last; within each group the chosen mode applies.
 * Returns a NEW array; the input is never mutated.
 */

export type SortMode = 'soonest' | 'newest';

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

function bySoonest(a: PoolSortJob, b: PoolSortJob): number {
  const ta = time(a.scheduledStart);
  const tb = time(b.scheduledStart);
  if (ta === null && tb !== null) return 1;
  if (ta !== null && tb === null) return -1;
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;
  return byCreatedDesc(a, b);
}

export function sortPoolJobs<T extends PoolSortJob>(
  jobs: readonly T[],
  mode: SortMode,
  isAssigned: (job: T) => boolean,
): T[] {
  const cmp = mode === 'soonest' ? bySoonest : byCreatedDesc;
  const unassigned = jobs.filter((j) => !isAssigned(j));
  const assigned = jobs.filter((j) => isAssigned(j));
  return [...unassigned.sort(cmp), ...assigned.sort(cmp)];
}
