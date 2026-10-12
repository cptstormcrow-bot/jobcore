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

/** "Job #<n> - Created: <date>" line; missing values render as an em dash. */
export function formatJobNumberLine(
  jobNumber: number | string | null | undefined,
  createdAt: string | Date | null | undefined,
  locale?: string,
): string {
  return `Job #${jobNumber ?? '—'} - Created: ${formatCreatedDate(createdAt, locale)}`;
}

/** "Scheduled - <weekday, date> at <time>", or the Unscheduled label when no valid date. */
export function formatScheduledLabel(
  scheduledStart: string | Date | null | undefined,
  canAdjust: boolean,
  locale?: string,
): string {
  const d = toValidDate(scheduledStart);
  if (!d) return canAdjust ? 'Unscheduled ▸' : 'Unscheduled';
  const datePart = d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  return `Scheduled - ${datePart} at ${timePart}`;
}
