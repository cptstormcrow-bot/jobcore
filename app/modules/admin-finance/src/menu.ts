import type { MenuItem } from '@jobcore/ui';

/** Top-level Admin & Finance views, in hamburger-menu order. */
export const ADMIN_FINANCE_VIEWS = [
  'overview',
  'leadInbox',
  'jobs',
  'assignmentBoard',
  'priceSheetList',
  'payments',
  'paymentReview',
  'calendar',
  'payroll',
  'reports',
  'employee-roster',
] as const;

export type AdminFinanceView = (typeof ADMIN_FINANCE_VIEWS)[number];

const LABELS: Record<AdminFinanceView, string> = {
  overview: 'Overview',
  leadInbox: 'Leads',
  jobs: 'Jobs',
  assignmentBoard: 'Assignments',
  priceSheetList: 'Price Sheets',
  payments: 'Payments',
  paymentReview: 'Review',
  calendar: 'Calendar',
  payroll: 'Payroll',
  reports: 'Reports',
  'employee-roster': 'Employees',
};

export function isAdminFinanceView(value: unknown): value is AdminFinanceView {
  return typeof value === 'string' && (ADMIN_FINANCE_VIEWS as readonly string[]).includes(value);
}

/** Builds the 11-item Admin & Finance main menu; `onSelect` decides how a pick navigates. */
export function buildAdminFinanceMenuItems(onSelect: (view: AdminFinanceView) => void): MenuItem[] {
  return ADMIN_FINANCE_VIEWS.map((view) => ({ id: view, label: LABELS[view], onPress: () => onSelect(view) }));
}
