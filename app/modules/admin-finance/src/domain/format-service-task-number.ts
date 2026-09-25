/**
 * Service-task display-number formatting (F11 slice S6).
 *
 * Pure, dependency-free formatting helper for admin-finance service task UI.
 */

/**
 * Formats a display-only short number for a service task.
 *
 * `task_number` comes from migration 0067; when it is a finite number it is
 * zero-padded to 12 digits and prefixed `ST-`. Until that migration is
 * applied (or for tasks without a `task_number`), falls back to the last
 * hyphen-separated group of the task's `id` (for a UUID this is the trailing
 * 12 hex characters), also prefixed `ST-`.
 */
export function formatServiceTaskNumber(task: { id: string; taskNumber?: number | null }): string {
  if (typeof task.taskNumber === 'number' && Number.isFinite(task.taskNumber)) {
    return 'ST-' + String(task.taskNumber).padStart(12, '0');
  }

  const parts = task.id.split('-');
  const tail = parts[parts.length - 1];
  return 'ST-' + tail;
}
