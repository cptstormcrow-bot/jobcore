/**
 * Money and percent input parsing for admin-finance form fields.
 *
 * Pure string handling, no float arithmetic on user text, no React.
 */

/**
 * Parses a user-typed dollar amount into integer cents.
 *
 * Trims, strips a leading `$`, commas and inner spaces. Accepts `12`, `12.5`,
 * `12.50`, `.5`, `0`. Integer and fraction parts are parsed as strings so no
 * float error is introduced. Returns `null` for empty, negative, non-numeric
 * input or more than 2 decimal places.
 */
export function parseMoneyToCents(raw: string): number | null {
  const stripped = raw.trim().replace(/^\$/, '').replace(/[,\s]/g, '');
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(stripped);
  if (!match) {
    return null;
  }
  const whole = match[1] ?? '';
  const frac = match[2] ?? '';
  if (whole === '' && frac === '') {
    return null;
  }
  const dollars = whole === '' ? 0 : Number(whole);
  const cents = frac === '' ? 0 : Number(frac.padEnd(2, '0'));
  const total = dollars * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * Formats integer cents as a plain dollar string with 2 decimals (`1250` ->
 * `'12.50'`). Returns `''` for `null`, `undefined` or `NaN`.
 */
export function centsToDollarsText(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) {
    return '';
  }
  return (cents / 100).toFixed(2);
}

/**
 * Parses a user-typed percent into a number from 0 to `max` inclusive
 * (`max` defaults to 100).
 *
 * Trims and strips a trailing `%` and spaces. Accepts a non-negative number
 * with at most 2 decimals. Returns `null` for empty, negative, over `max` or
 * non-numeric input.
 */
export function parsePercent(raw: string, max = 100): number | null {
  const stripped = raw.trim().replace(/[%\s]+$/, '').replace(/\s/g, '');
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(stripped)) {
    return null;
  }
  const value = Number(stripped);
  if (!Number.isFinite(value) || value < 0 || value > max) {
    return null;
  }
  return value;
}
