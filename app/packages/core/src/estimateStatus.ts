/**
 * Estimate status change rules.
 * 'rejected' is display-only (never a target); a tech never touches Approved or Rejected.
 * Leaving Approved warns because the Estimate/Approval stages go red once schedule/assign are done.
 */
export type EstimateStatusValue = 'draft' | 'submitted' | 'approved' | 'rejected';
export type EstimateEditorRole = 'admin' | 'tech';

const ADMIN: Record<EstimateStatusValue, EstimateStatusValue[]> = {
  draft: ['submitted', 'approved'],
  submitted: ['draft', 'approved'],
  approved: ['draft', 'submitted'],
  rejected: ['draft', 'submitted', 'approved'],
};
const TECH: Record<EstimateStatusValue, EstimateStatusValue[]> = {
  draft: ['submitted'],
  submitted: ['draft'],
  approved: [],
  rejected: [],
};

export function allowedEstimateMoves(
  role: EstimateEditorRole,
  from: EstimateStatusValue,
): EstimateStatusValue[] {
  return [...(role === 'admin' ? ADMIN : TECH)[from]];
}

export function needsDownstreamWarning(from: EstimateStatusValue, to: EstimateStatusValue): boolean {
  return from === 'approved' && to !== 'approved';
}
