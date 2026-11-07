/**
 * Service Tech assignment gate (screen #0057).
 *
 * Pure, dependency-free helper. Assigning a Service Tech opens once the estimate is Approved, or on
 * materials having arrived onsite, from either the estimate's Materials Onsite
 * checkbox or the Prem/investigation `materials_arrived` flag. A missing
 * estimate never blocks by itself. Unassigning is never gated, and Prem Tech
 * assignment is not gated.
 */

export const SERVICE_TECH_GATE_HINT = 'Cannot assign Service Tech until the estimate is approved or materials arrive onsite.';

export const SCHEDULE_MATERIALS_HINT = 'Check Materials Onsite on the estimate before saving it to the schedule.';

/**
 * Scheduling gate (Jeff 2026-11-06, uber 156): a job cannot be put on the schedule while the
 * estimate's Materials Onsite box is unchecked. Like the Service Tech gate, a job with no
 * estimate row is not blocked by this alone. Removing a job from the schedule is never gated.
 */
export function canScheduleJob(estimate: { materialsOnsite?: boolean } | null | undefined): boolean {
  return !estimate || estimate.materialsOnsite === true;
}

/**
 * Returns true when either the estimate's `materialsOnsite` flag or the
 * investigation's `materialsArrived` flag is exactly `true`. A missing estimate
 * or investigation, or an undefined, null or false flag, counts as not arrived.
 */
export function canAssignServiceTech(
  estimate: { materialsOnsite?: boolean; status?: string } | null | undefined,
  investigation?: { materialsArrived?: boolean | null } | null
): boolean {
  return estimate?.status === 'approved' || estimate?.materialsOnsite === true || investigation?.materialsArrived === true;
}
