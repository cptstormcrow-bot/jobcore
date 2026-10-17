import type { Job } from '@jobcore/core';

/** Milliseconds between arrive (inProgressAt, else enRouteAt) and completedAt; null if unknown or negative. */
export function workDurationMs(job: Pick<Job, 'enRouteAt' | 'inProgressAt' | 'completedAt'>): number | null {
  const startIso = job.inProgressAt ?? job.enRouteAt;
  const endIso = job.completedAt;
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

/** "2h 15m", "45m", "-" when null. */
export function formatWorkDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '-';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
