/**
 * Admin & Finance Overview cards — one per hamburger menu entry, in menu order.
 *
 * Kept RN-free (zero imports) so `npm test` can assert it under Node type-stripping.
 */

export type OverviewCardId =
  | 'leadInbox' | 'jobs' | 'assignmentBoard' |'priceSheetList'
  | 'payments' | 'paymentReview' | 'payroll' | 'calendar' | 'reports' | 'employee-roster';

export interface OverviewCounts {
  jobsOnFile: number;
  qualifiedOrScheduled: number;
  awaitingCloseOut: number;
  employees: number;
  /** null when the best-effort fetch failed or has not resolved yet */
  needsAttentionPayments: number | null;
}

export interface OverviewCard {
  id: OverviewCardId;
  title: string;
  subtitle: string;
}

export function buildOverviewCards(counts: OverviewCounts): OverviewCard[] {
  const review =
    counts.needsAttentionPayments === null
      ? 'Reconcile payments'
      : `${counts.needsAttentionPayments} pending`;
  return [
    { id: 'leadInbox', title: 'Leads', subtitle: 'View leads' },
    { id: 'jobs', title: 'Jobs', subtitle: `${counts.jobsOnFile} on file for this organization` },
    { id: 'assignmentBoard', title: 'Assignments', subtitle: `${counts.qualifiedOrScheduled} qualified or scheduled` },
    { id: 'priceSheetList', title: 'Price Sheets', subtitle: 'Rates and area adjustments' },
    { id: 'payments', title: 'Payments & Payouts', subtitle: 'Payments and payout batches' },
    { id: 'paymentReview', title: 'Review', subtitle: review },
    { id: 'payroll', title: 'Payroll', subtitle: 'Weekly hours and pay' },
    { id: 'calendar', title: 'Calendar', subtitle: 'Schedule by day and tech' },
    { id: 'reports', title: 'Reports', subtitle: 'View reports' },
    { id: 'employee-roster', title: 'Employees', subtitle: `${counts.employees} on file` },
  ];
}
