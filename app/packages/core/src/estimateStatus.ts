/**
 * Estimate status change rules.
 * Only an admin can move a Submitted estimate to 'rejected'; the admin resubmits it. A tech never touches Approved or Rejected.
 * Leaving Approved warns because the Estimate/Approval stages go red once schedule/assign are done.
 */
export type EstimateStatusValue = 'draft' | 'submitted' | 'approved' | 'rejected';
export type EstimateEditorRole = 'admin' | 'tech';

const ADMIN: Record<EstimateStatusValue, EstimateStatusValue[]> = {
  draft: ['submitted', 'approved'],
  submitted: ['draft', 'approved', 'rejected'],
  approved: ['draft', 'submitted'],
  rejected: ['draft', 'submitted'],
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

export interface EstimateStageFlags {
  estimateComplete: boolean;
  approvalComplete: boolean;
  rejected: boolean;
}

/** Maps an estimate status (null/undefined = no estimate yet) to the Estimate and Approval timeline facts. */
export function estimateStageFlags(status: EstimateStatusValue | null | undefined): EstimateStageFlags {
  return {
    estimateComplete: status === 'submitted' || status === 'approved',
    approvalComplete: status === 'approved',
    rejected: status === 'rejected',
  };
}
