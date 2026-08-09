/**
 * Pure reporting grouping helpers (P3l.1a).
 *
 * Groups an array of `Job` domain objects by `status` or `source`. Pure,
 * no I/O — callers own fetching the `Job[]` from a repository.
 */

import type { Job, JobStatus } from '@jobcore/core';

/** Groups jobs by their `status` field. Every job appears in exactly one group. */
export function byStatus(jobs: readonly Job[]): Record<JobStatus, Job[]> {
  const groups = {} as Record<JobStatus, Job[]>;
  for (const job of jobs) {
    (groups[job.status] ??= []).push(job);
  }
  return groups;
}

/**
 * Groups jobs by their `source` field. `source` is nullable wire data
 * (`0004_scheduling.sql:95`, mapped through `../data/ports.ts`'s `toJob`);
 * a null/missing source groups under the literal key `'unknown'` rather
 * than being dropped or throwing — mirrors the module's honest-unknown
 * discipline (see P3l.2's `slot-hit-rate.ts` for the same pattern).
 */
export function bySource(jobs: readonly Job[]): Record<string, Job[]> {
  const groups: Record<string, Job[]> = {};
  for (const job of jobs) {
    const key = job.source ?? 'unknown';
    (groups[key] ??= []).push(job);
  }
  return groups;
}

/**
 * Groups jobs by their `attachTiming` field. `attachTiming` is nullable
 * text (DB column `attach_timing`, mapped through `../data/ports.ts`'s
 * `toJob`); a null/missing value groups under the literal key `'unknown'`,
 * same discipline as `bySource` above.
 */
export function byAttachTiming(jobs: readonly Job[]): Record<string, Job[]> {
  const groups: Record<string, Job[]> = {};
  for (const job of jobs) {
    const key = job.attachTiming ?? 'unknown';
    (groups[key] ??= []).push(job);
  }
  return groups;
}
