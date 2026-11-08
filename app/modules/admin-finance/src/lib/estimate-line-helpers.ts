/**
 * Pure estimate-line helpers (no React Native, no ports import: local structural types only).
 */

export interface StaleLineLike {
  jobPlanTaskId?: string | null;
  taskSnapshotAt?: string | null;
}
export interface StaleTaskLike {
  contentUpdatedAt?: string | null;
}

/** True only when the linked task changed after the line's snapshot. Missing/unparseable input => false. */
export function isLineStale(line: StaleLineLike, task: StaleTaskLike | null | undefined): boolean {
  if (typeof line.jobPlanTaskId !== 'string' || line.jobPlanTaskId.length === 0) return false;
  if (!task) return false;
  if (!line.taskSnapshotAt || !task.contentUpdatedAt) return false;
  const snap = Date.parse(line.taskSnapshotAt);
  const upd = Date.parse(task.contentUpdatedAt);
  if (Number.isNaN(snap) || Number.isNaN(upd)) return false;
  return upd > snap;
}

/** MUST mirror lower(btrim(name)) in migration 0094. */
export function normalizeCatalogName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

export interface CatalogNameLike {
  id: string;
  name: string;
  active?: boolean | null;
}

/** First row with the same normalized name; inactive rows count (matches the 0094 RPC). */
export function findCatalogDuplicate<T extends CatalogNameLike>(
  catalog: readonly T[],
  name: string,
): T | undefined {
  const key = normalizeCatalogName(name);
  if (key === '') return undefined;
  return catalog.find((r) => normalizeCatalogName(r.name) === key);
}

export interface PlanTaskLike {
  id: string;
  title?: string | null;
  serviceTaskId?: string | null;
  quantity?: number | null;
  notes?: string | null;
  estimatedMinutes?: number | null;
  unit?: string | null;
  area?: string | null;
  materialsNote?: string | null;
}

/** Line draft fields minus every price field (unitCost, lineTotal): callers supply price. */
export interface LineDraftFromTask {
  kind: 'labor';
  description: string;
  quantity: number;
  jobPlanTaskId: string;
  serviceTaskId: string | null;
  unit: string | undefined;
  area: string | undefined;
  materialsNote: string | undefined;
}

/**
 * Per-unit price for a price-sheet task. The catalog rate wins; when the task's
 * catalog row carries no rate (the price sheet holds it, and the task's frozen
 * price is rate x quantity) fall back to price / quantity, else 0.
 */
export function taskBaseUnitCost(task: { rate?: number | null; price?: number | null; quantity?: number | null }): number {
  if (task.rate != null) return task.rate;
  const q = typeof task.quantity === 'number' && task.quantity > 0 ? task.quantity : 1;
  return task.price != null && task.price > 0 ? Math.round((task.price / q) * 100) / 100 : 0;
}

/** Same defaults as Build-from-tasks: kind labor, description = title, quantity > 0 else 1. */
export function taskToLineDraft(task: PlanTaskLike): LineDraftFromTask {
  const q = task.quantity;
  return {
    kind: 'labor',
    description: task.title ?? '',
    quantity: typeof q === 'number' && q > 0 ? q : 1,
    jobPlanTaskId: task.id,
    serviceTaskId: task.serviceTaskId ?? null,
    unit: task.unit ?? undefined,
    area: task.area ?? undefined,
    materialsNote: task.materialsNote ?? undefined,
  };
}
