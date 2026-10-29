/**
 * Pure helpers for a queued estimate line-item edit.
 *
 * `estimateLinePatchToRow` builds the DB column patch (only fields the caller set,
 * plus the task_snapshot_at stamp). `applyEstimateLinePatch` produces the optimistic
 * camelCase item shown right away. Both take the stamp from the caller so a replay
 * writes the same value that was shown. No transport, no imports.
 */
export interface EstimateLinePatchInput {
  kind?: string;
  description?: string;
  quantity?: number;
  unitCost?: number;
  lineTotal?: number;
  serviceTaskId?: string | null;
  unit?: string | null;
  area?: string | null;
  materialsNote?: string | null;
}

const FIELD_TO_COLUMN: ReadonlyArray<readonly [keyof EstimateLinePatchInput, string]> = [
  ['kind', 'kind'],
  ['description', 'description'],
  ['quantity', 'quantity'],
  ['unitCost', 'unit_cost'],
  ['lineTotal', 'line_total'],
  ['serviceTaskId', 'service_task_id'],
  ['unit', 'unit'],
  ['area', 'area'],
  ['materialsNote', 'materials_note'],
];

/** DB column patch for the fields the caller set (undefined = untouched), stamped with task_snapshot_at. */
export function estimateLinePatchToRow(patch: EstimateLinePatchInput, snapshotAt: string): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, column] of FIELD_TO_COLUMN) {
    if (patch[field] !== undefined) row[column] = patch[field];
  }
  row.task_snapshot_at = snapshotAt;
  return row;
}

/** Optimistic item: the existing camelCase item with the patch laid over it and the snapshot stamp moved. */
export function applyEstimateLinePatch<T extends { taskSnapshotAt?: string }>(
  item: T,
  patch: EstimateLinePatchInput,
  snapshotAt: string,
): T {
  const next: Record<string, unknown> = { ...item };
  for (const [field] of FIELD_TO_COLUMN) {
    if (patch[field] !== undefined) next[field] = patch[field];
  }
  next.taskSnapshotAt = snapshotAt;
  return next as T;
}
