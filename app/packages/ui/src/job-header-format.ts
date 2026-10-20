// Pure formatters shared by JobHeaderBlock (no React / RN / workspace imports).
// Kept dependency-free so the assertion runner can load this file directly.

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Created date in the given locale, or an em dash when missing/invalid. */
export function formatCreatedDate(createdAt: string | Date | null | undefined, locale?: string): string {
  const d = toValidDate(createdAt);
  return d ? d.toLocaleDateString(locale) : '—';
}

/** "Job #<n> - <date>" line; missing values render as an em dash. */
export function formatJobNumberLine(
  jobNumber: number | string | null | undefined,
  createdAt: string | Date | null | undefined,
  locale?: string,
): string {
  return `Job #${jobNumber ?? '—'} - ${formatCreatedDate(createdAt, locale)}`;
}

/** "Job #<n>" for a finite job number; "Job #—" otherwise (never falls back to a raw id). */
export function formatJobNumberLabel(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? `Job #${n}` : 'Job #—';
}

/** Two separate lines: "Job #<n>" and the created date (em dash when missing/invalid). */
export function formatJobHeaderLines(
  jobNumber: number | string | null | undefined,
  createdAt: string | Date | null | undefined,
  locale?: string,
): { jobLine: string; dateLine: string } {
  return {
    jobLine: `Job #${jobNumber ?? '—'}`,
    dateLine: formatCreatedDate(createdAt, locale),
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Monday, Dec 14, 2026 - 9am" (local time, no Intl); "Unscheduled" when missing/invalid. */
export function formatScheduleLabel(scheduledStart: string | Date | null | undefined): string {
  const d = toValidDate(scheduledStart);
  if (!d) return 'Unscheduled';
  const h24 = d.getHours();
  const minutes = d.getMinutes();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = minutes === 0 ? '' : `:${minutes < 10 ? '0' : ''}${minutes}`;
  const ampm = h24 < 12 ? 'am' : 'pm';
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} - ${h12}${mm}${ampm}`;
}

/** Title-bar schedule label; delegates to formatScheduleLabel (adds the adjust chevron when unscheduled). */
export function formatScheduledLabel(
  scheduledStart: string | Date | null | undefined,
  canAdjust: boolean,
  _locale?: string,
): string {
  const label = formatScheduleLabel(scheduledStart);
  return label === 'Unscheduled' && canAdjust ? 'Unscheduled ▸' : label;
}
