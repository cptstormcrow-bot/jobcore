import { colors } from '@jobcore/ui';

/**
 * Colour of the heavy rule under the job header on every Job timeline screen
 * (#0041, #0057, #0061, #0077, #0078, #0018, #0024). Jeff 2026-11-05: it is a status
 * indicator tied to Start and Complete. Black before the job is started,
 * yellow once Start is pressed (in progress), green once the job is complete
 * (completed, paid or closed).
 */
export function jobRuleColor(status: string | null | undefined): string {
  if (status === 'completed' || status === 'paid' || status === 'closed') return colors.paidBar;
  if (status === 'in_progress') return colors.estimateApprovedBar;
  return colors.text;
}

/** Tooltip wording for the status rule (press-and-hold, Jeff 2026-11-05). */
export function jobRuleState(status: string | null | undefined): string {
  if (status === 'completed' || status === 'paid' || status === 'closed') return 'Job is complete (green)';
  if (status === 'in_progress') return 'Job is started, in progress (yellow)';
  return 'Job is not started yet (black)';
}
