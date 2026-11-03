// Replay-side stale-write guard for queued job edits. Decision logic lives in
// @jobcore/core (job-edit-guard); this file only does the reads/writes.
// No SQLite, no React, no imports from offline-db / read-cache (cycle safety).
import { decideJobEdit, describeJobEditConflict, type JobEditBase } from '@jobcore/core';
import type { OpContext } from './index';

/** The row kept changing under us (3 tries). status 422 -> 'permanent' (409 would classify as 'unknown' and retry), so it shows on Sync issues instead of holding the queue. */
class JobEditRaceError extends Error {
  status = 422 as const;
  code = 'JOB_EDIT_RACE' as const;
  constructor() {
    super('This job kept changing while saving. Open it and try again.');
    this.name = 'JobEditRaceError';
  }
}

/** The server refused the update (0 rows, row unchanged: RLS). status 403 -> 'permission', shown on Sync issues. */
class JobEditDeniedError extends Error {
  status = 403 as const;
  code = 'JOB_EDIT_DENIED' as const;
  constructor() {
    super('The server did not accept this change to the job.');
    this.name = 'JobEditDeniedError';
  }
}

const RACE_TRIES = 3;

/**
 * Updates `jobs` row `jobId` with `update`. With no `base` (rows queued before the guard
 * shipped) this is the old unconditional update. With a base it pre-reads the row,
 * merges what the server did not touch, and on a true clash still writes ours and notes it.
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
  for (let attempt = 1; attempt <= RACE_TRIES; attempt++) {
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
      if (!rows || rows.length === 0) {
        // 0 rows: either the row moved on (race, re-decide) or the server refused it (RLS).
        const { data: now, error: nowErr } = await ctx.supabase
          .from('jobs')
          .select('updated_at')
          .eq('id', jobId)
          .maybeSingle();
        if (nowErr) throw nowErr;
        const moved = (now as { updated_at?: string } | null)?.updated_at !== server.updated_at;
        if (!moved) throw new JobEditDeniedError();
        continue;
      }
    }
    if (decision.conflicts.length > 0) ctx.note?.(describeJobEditConflict(decision.conflicts, applyCount));
    return;
  }
  throw new JobEditRaceError();
}
