/**
 * Job-detail screen helpers (pure, no side effects, no React).
 *
 * These functions are structurally typed against `ServiceArea`/`JobEstimate`
 * shapes from `../data/ports` rather than importing those interfaces
 * directly, so this module stays decoupled from in-flight port changes
 * (e.g. `ServiceArea.zipCodes` landing in a separate slice).
 */

/**
 * Extracts the first 5-digit US zip code from a free-form address string,
 * preferring the LAST match (a zip typically trails city/state at the end
 * of an address). Returns null if none found.
 */
export function extractZip(address: string | null | undefined): string | null {
  if (!address) return null;
  const matches = address.match(/\b(\d{5})(?:-\d{4})?\b/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1] ?? '';
  return last.slice(0, 5);
}

/**
 * Finds the first service area whose `zipCodes` list contains `zip`.
 * Returns null if `zip` is null or no area matches.
 */
export function matchServiceAreaByZip<T extends { id: string; zipCodes?: string[] | null }>(
  areas: T[],
  zip: string | null,
): T | null {
  if (!zip) return null;
  return areas.find((area) => area.zipCodes?.includes(zip)) ?? null;
}

/** Planning fields that can be seeded from an investigation's findings. */
export type PlanningSeedFields = {
  ingressNotes: string | null;
  logisticsNotes: string | null;
  parkingNotes: string | null;
  stateAssessment: string | null;
};

/**
 * Returns a copy of `planning` where each null/empty field is backfilled
 * from `investigation`'s same-named field (when that field is non-empty).
 * Fields already populated on `planning` are left unchanged.
 */
export function seedPlanningFromInvestigation(
  planning: PlanningSeedFields,
  investigation: Partial<PlanningSeedFields> | null | undefined,
): PlanningSeedFields {
  const result = { ...planning };
  if (!investigation) return result;
  const keys: (keyof PlanningSeedFields)[] = [
    'ingressNotes',
    'logisticsNotes',
    'parkingNotes',
    'stateAssessment',
  ];
  for (const key of keys) {
    const current = result[key];
    const seed = investigation[key];
    if ((current === null || current === '') && seed) {
      result[key] = seed;
    }
  }
  return result;
}

/**
 * Formats the elapsed time between `fromIso` and `now` as a short label:
 * "Nd Nh" (>=1 day), "Nh Nm" (>=1 hour), or "Nm" otherwise. Returns null if
 * `fromIso` is absent. Negative elapsed time clamps to "0m".
 */
export function formatElapsed(fromIso: string | null | undefined, now: Date = new Date()): string | null {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  const diffMs = now.getTime() - from.getTime();
  if (diffMs <= 0) return '0m';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor(totalMinutes / 60);
  if (days >= 1) {
    const remHours = hours - days * 24;
    return `${days}d ${remHours}h`;
  }
  if (hours >= 1) {
    const remMinutes = totalMinutes - hours * 60;
    return `${hours}h ${remMinutes}m`;
  }
  return `${totalMinutes}m`;
}

/**
 * Returns the street portion of `address` (text before the first comma),
 * trimmed and truncated to `max` characters (with a trailing "…" when
 * truncated). Empty/absent input returns "".
 */
export function abbreviate(address: string | null | undefined, max = 18): string {
  if (!address) return '';
  const street = (address.split(',')[0] ?? '').trim();
  if (street.length <= max) return street;
  return `${street.slice(0, max - 1)}…`;
}
