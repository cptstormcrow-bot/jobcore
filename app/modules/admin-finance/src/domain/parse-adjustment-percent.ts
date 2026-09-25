/**
 * Adjustment-percent input parsing (F10 slice S4).
 *
 * Pure string-to-number parsing, no new dependency. Feeds admin-finance
 * area-adjustment percent fields, where users may type `%`, a leading `+`,
 * or stray whitespace alongside the numeric value.
 */

/**
 * Parses a user-typed adjustment-percent string into a number.
 *
 * Strips all `%` characters, a leading `+`, and all whitespace, then
 * validates the remainder via `Number()`/`Number.isFinite` (rejecting
 * malformed input like `'1e'` or `'--5'`). Returns `null` when the input
 * is empty after stripping or does not parse to a finite number.
 */
export function parseAdjustmentPercent(input: string): number | null {
  const stripped = input.replace(/%/g, '').replace(/\s/g, '').replace(/^\+/, '');

  if (stripped === '') {
    return null;
  }

  const parsed = Number(stripped);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}
