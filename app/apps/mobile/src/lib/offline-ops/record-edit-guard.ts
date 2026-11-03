// Replay-side stale-write guard for queued edits to leads, estimates, line items,
// payroll time and photo notes. Decision logic lives in @jobcore/core
// (record-edit-guard); this file only does the reads/writes. Mirrors job-edit-guard.
// No SQLite, no React, no imports from offline-db / read-cache (cycle safety).
import {
  decideRecordEdit,
  describeRecordEditConflict,
  type EditPolicy,
  type RecordEditBase,
} from '@jobcore/core';
import type { OpContext } from './index';

/** Same-field clash on an important field. status 422 -> 'permanent' (shows on Sync issues). */
export class RecordEditConflictError extends Error {
  status = 422 as const;
  code = 'RECORD_EDIT_CONFLICT' as const;
  constructor(public conflicts: string[], appliedCount: number, record: string) {
    super(describeRecordEditConflict(conflicts, appliedCount, record));
    this.name = 'RecordEditConflictError';
  }
}

/** The row kept changing under us (3 tries). 422 so it shows on Sync issues instead of holding the queue. */
class RecordEditRaceError extends Error {
  status = 422 as const;
  code = 'RECORD_EDIT_RACE' as const;
  constructor(record: string) {
    super(`This ${record} kept changing while saving. Open it and try again.`);
    this.name = 'RecordEditRaceError';
  }
}

/** 0 rows and the row did not move: the server refused it (RLS). 403 -> 'permission'. */
class RecordEditDeniedError extends Error {
  status = 403 as const;
  code = 'RECORD_EDIT_DENIED' as const;
  constructor(record: string) {
    super(`The server did not accept this change to the ${record}.`);
    this.name = 'RecordEditDeniedError';
  }
}

const RACE_TRIES = 3;

export interface GuardOptions {
  /** Column the row is matched on (default 'id'). */
  idCol?: string;
  /** Version column for a compare-and-set write; only for tables that have one. */
  versionCol?: 'updated_at';
  /** Plain name used in messages, e.g. 'lead', 'time entry'. */
  record: string;
  /** Row not found (e.g. an estimate not created yet): run this instead of the plain update. */
  onMissing?: () => Promise<void>;
}

/**
 * Updates `table` row `id` with `update`. With no `base` (rows queued before the guard
 * shipped) this is the old unconditional update. With a base it pre-reads the row and
 * writes only what `decideRecordEdit` allows: simple fields win, notes keep both
 * versions, and an important field someone else changed throws RecordEditConflictError.
 * Tables without a version column fall back to a plain update after the decision.
 */
export async function updateRecordGuarded(
  ctx: OpContext,
  table: string,
  id: string,
  update: Record<string, unknown>,
  base: RecordEditBase | undefined,
  policy: Readonly<Record<string, EditPolicy>>,
  opts: GuardOptions
): Promise<void> {
  const idCol = opts.idCol ?? 'id';
  if (!base) {
    const { error } = await ctx.supabase.from(table).update(update).eq(idCol, id).select(idCol);
    if (error) throw error;
    return;
  }

  const cols = Object.keys(update);
  const selectCols = opts.versionCol ? [opts.versionCol, ...cols] : cols;
  for (let attempt = 1; attempt <= RACE_TRIES; attempt++) {
    const { data, error: readErr } = await ctx.supabase
      .from(table)
      .select(selectCols.join(','))
      .eq(idCol, id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!data) {
      if (opts.onMissing) return opts.onMissing();
      // Row not visible/gone: same as the old path.
      const { error } = await ctx.supabase.from(table).update(update).eq(idCol, id).select(idCol);
      if (error) throw error;
      return;
    }

    const server = data as unknown as Record<string, unknown>;
    // Without a version column the "row unchanged" shortcut cannot apply.
    const decision = decideRecordEdit(update, opts.versionCol ? base : { values: base.values }, server, policy);
    const applyCount = Object.keys(decision.apply).length;

    if (applyCount > 0) {
      let q = ctx.supabase.from(table).update(decision.apply).eq(idCol, id);
      if (opts.versionCol) q = q.eq(opts.versionCol, server[opts.versionCol] as string);
      const { data: rows, error } = await q.select(idCol);
      if (error) throw error;
      if (!rows || rows.length === 0) {
        if (!opts.versionCol) throw new RecordEditDeniedError(opts.record);
        const { data: now, error: nowErr } = await ctx.supabase
          .from(table)
          .select(opts.versionCol)
          .eq(idCol, id)
          .maybeSingle();
        if (nowErr) throw nowErr;
        const moved = (now as Record<string, unknown> | null)?.[opts.versionCol] !== server[opts.versionCol];
        if (!moved) throw new RecordEditDeniedError(opts.record);
        continue;
      }
    }
    if (decision.conflicts.length > 0) {
      throw new RecordEditConflictError(decision.conflicts, applyCount, opts.record);
    }
    return;
  }
  throw new RecordEditRaceError(opts.record);
}
