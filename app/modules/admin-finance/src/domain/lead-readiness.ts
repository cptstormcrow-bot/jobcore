/**
 * Lead readiness classifier (P3e.2).
 *
 * The website's "hero quick form" (Name / Phone / Service only — see
 * `00-MASTER-SPEC.md`) is a legitimate, expected intake path, not a data
 * error. A lead captured that way genuinely lacks `preferredDate` and
 * `address` at the DB level. This module makes that state first-class:
 * `missingFields` never hides a gap and `classifyLead` never silently
 * defaults a missing field to a placeholder value. A lead inbox screen must
 * show incomplete leads AS incomplete, with exactly which fields are
 * missing, so staff can follow up rather than schedule against a guess.
 */

import type { Lead } from './lead';

/**
 * The fields a lead needs before it can move to scheduling. Deliberately a
 * curated subset of `Lead`, not every nullable column — `preferredDate` and
 * `address` are the two the booking form collects that the hero quick form
 * does not, and are exactly what scheduling a job requires. Order here is
 * the order `missingFields` reports them in.
 */
const REQUIRED_FOR_SCHEDULING: ReadonlyArray<{
  key: 'preferredDate' | 'address';
  field: keyof Lead;
}> = [
  { key: 'preferredDate', field: 'preferredDate' },
  { key: 'address', field: 'address' },
];

export type LeadStatus = 'ready' | 'needs_info';

/**
 * Returns the list of required-for-scheduling fields that are missing
 * (null, or an empty/whitespace-only string) on this lead, in a fixed,
 * stable order. An empty array means the lead is fully ready.
 */
export function missingFields(lead: Lead): Array<'preferredDate' | 'address'> {
  return REQUIRED_FOR_SCHEDULING.filter(({ field }) => isMissing(lead[field])).map(
    ({ key }) => key,
  );
}

/**
 * Classifies a lead as `'ready'` (nothing required is missing) or
 * `'needs_info'` (at least one required field is missing). Never defaults a
 * missing field to a placeholder — this is purely a read of `missingFields`.
 */
export function classifyLead(lead: Lead): LeadStatus {
  return missingFields(lead).length === 0 ? 'ready' : 'needs_info';
}

function isMissing(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}
