/**
 * Service Tech assignment gate (screen #0057).
 *
 * Pure, dependency-free helper. Assigning a Service Tech is gated on the
 * estimate's Materials Onsite checkbox. Unassigning is never gated, and
 * Prem Tech assignment is not gated.
 */

export const SERVICE_TECH_GATE_HINT = 'Mark Materials Onsite on the estimate first.';

/**
 * Returns true only when the estimate's `materialsOnsite` flag is exactly
 * `true`. A missing estimate, or an undefined or false flag, returns false.
 */
export function canAssignServiceTech(estimate: { materialsOnsite?: boolean } | null | undefined): boolean {
  return estimate?.materialsOnsite === true;
}
