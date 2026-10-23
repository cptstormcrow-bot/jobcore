/**
 * Service Tech assignment gate (screen #0057).
 *
 * Pure, dependency-free helper. Assigning a Service Tech is gated ONLY on
 * materials having arrived onsite, from either the estimate's Materials Onsite
 * checkbox or the Prelim/investigation `materials_arrived` flag. A missing
 * estimate never blocks by itself. Unassigning is never gated, and Prem Tech
 * assignment is not gated.
 */

export const SERVICE_TECH_GATE_HINT = 'Cannot assign Service Tech until materials arrive onsite.';

/**
 * Returns true when either the estimate's `materialsOnsite` flag or the
 * investigation's `materialsArrived` flag is exactly `true`. A missing estimate
 * or investigation, or an undefined, null or false flag, counts as not arrived.
 */
export function canAssignServiceTech(
  estimate: { materialsOnsite?: boolean } | null | undefined,
  investigation?: { materialsArrived?: boolean | null } | null
): boolean {
  return estimate?.materialsOnsite === true || investigation?.materialsArrived === true;
}
