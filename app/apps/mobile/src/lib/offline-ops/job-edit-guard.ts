// Replay-side stale-write guard for queued job edits. Decision logic lives in
// @jobcore/core (job-edit-guard); this file only does the reads/writes.
// No SQLite, no React, no imports from offline-db / read-cache (cycle safety).
import { decideJobEdit, describeJobEditConflict, type JobEditBase } from '@jobcore/core';
import type { OpContext } from './index';

/** Thrown for a true same-field clash. status 422 -> classifyReplayError 'permanent' (shows on Sync issues). */
export class JobEditConflictError extends Error {
  status = 422 as const;
  code = 'JOB_EDIT_CONFLICT' as const;
  constructor(public conflicts: string[], appliedCount: number) {
    super(describeJobEditConflict(conflicts, appliedCount));
    this.name = 'JobEditConflictError';
  }
}

/** Raised when the row changed between our pre-read and our write; no code/status -> classified 'unknown' -> retried with backoff. */
class JobEditRaceError extends Error {
  constructor() {
    super('Job changed while saving; retrying');
    this.name = 'JobEditRaceError';
  }
}

/**
 * Updates `jobs` row `jobId` with `update`. With no `base` (rows queued before the guard
 * shipped) this is the old unconditional update. With a base it pre-reads the row,
 * merges what the server did not touch, and throws JobEditConflictError for true clashes.
 */
export async function updateJobGuarded(
  ctx: OpContext,
  jobId: string,
  update: Record<string, unknown>,
  base: JobEditBase | undefined
): Promise<void> {
  if (!base) {
    const { error } = await ctx.supabase.from('jobs').update(update).eq('id', jobId).select('id');
    if (error) throw error;
    return;
  }

  const cols = Object.keys(update);
  const { data, error: readErr } = await ctx.supabase
    .from('jobs')
    .select(['updated_at', ...cols].join(','))
    .eq('id', jobId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!data) {
    // Row not visible/gone: same as the old path (0 rows affected counts as applied).
    const { error } = await ctx.supabase.from('jobs').update(update).eq('id', jobId).select('id');
    if (error) throw error;
    return;
  }

  const server = data as unknown as Record<string, unknown>;
  const decision = decideJobEdit(update, base, server);
  const applyCount = Object.keys(decision.apply).length;

  if (applyCount > 0) {
    const { data: rows, error } = await ctx.supabase
      .from('jobs')
      .update(decision.apply)
      .eq('id', jobId)
      .eq('updated_at', server.updated_at as string)
      .select('id');
    if (error) throw error;
    if (!rows || rows.length === 0) throw new JobEditRaceError();
  }
  if (decision.conflicts.length > 0) throw new JobEditConflictError(decision.conflicts, applyCount);
}
