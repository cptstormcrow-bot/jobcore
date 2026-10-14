/**
 * PayrollPort is the seam between @jobcore/payroll-ui panels and each module's
 * data layer (AF/FT/SM). Panels import no Supabase/offline code; admin-only
 * members are optional and present only on the AF port.
 */
import type { wageEngine } from '@jobcore/core';

/** Lifecycle status of a payroll time entry. */
export type PayrollEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

/** How a time entry was created. */
export type PayrollEntrySource = 'manual' | 'clock';

/** One time entry for one worker on one day. */
export interface PayrollTimeEntry {
  /** Client-generated uuid. */
  id: string;
  /** Owning user id. */
  userId: string;
  /** Calendar day the work belongs to. */
  workDate: wageEngine.IsoDate;
  /** Worked minutes. */
  minutes: number;
  /** Clock-in timestamp, if clocked. */
  clockInAt: string | null;
  /** Clock-out timestamp, if clocked. */
  clockOutAt: string | null;
  /** Manual or clock origin. */
  source: PayrollEntrySource;
  /** Current review status. */
  status: PayrollEntryStatus;
  /** Free-text notes. */
  notes: string | null;
  /** Reason given when rejected. */
  rejectionReason: string | null;
}

/** Inclusive date range. */
export interface PayrollDateRange {
  /** First day of the range. */
  from: wageEngine.IsoDate;
  /** Last day of the range. */
  to: wageEngine.IsoDate;
}

/** Company payroll settings. */
export interface PayrollSettings {
  /** Overtime rules. */
  overtime: wageEngine.OvertimeConfig;
  /** Pay-week definition. */
  payWeek: wageEngine.PayWeekConfig;
}

/** Lifecycle status of a reimbursement. */
export type ReimbursementStatus = 'pending' | 'approved' | 'rejected' | 'paid';

/** A reimbursement request. */
export interface PayrollReimbursement {
  /** Reimbursement id. */
  id: string;
  /** Requesting user id. */
  userId: string;
  /** Amount in cents. */
  amountCents: number;
  /** What the expense was for. */
  description: string;
  /** Related job, if any. */
  jobId: string | null;
  /** Storage path of the receipt photo. */
  receiptPhotoPath: string | null;
  /** Current review status. */
  status: ReimbursementStatus;
  /** Reason given when rejected. */
  rejectionReason: string | null;
  /** Creation timestamp. */
  createdAt: string;
}

/** A reimbursement as seen by an approver, with the requester's name. */
export type AdminReimbursement = PayrollReimbursement & { employeeName: string };

/** Input for submitting a new reimbursement. */
export interface NewReimbursementInput {
  /** Client-generated uuid. */
  id: string;
  /** Amount in cents. */
  amountCents: number;
  /** What the expense was for. */
  description: string;
  /** Related job, if any. */
  jobId?: string | null;
  /** Required local photo URI of the receipt. */
  receiptUri: string;
}

/** One employee's pay week as seen by an approver. */
export interface TeamWeek {
  /** Employee user id. */
  userId: string;
  /** Employee display name. */
  employeeName: string;
  /** First day of the pay week. */
  weekStart: wageEngine.IsoDate;
  /** Last day of the pay week. */
  weekEnd: wageEngine.IsoDate;
  /** Entries in the week. */
  entries: PayrollTimeEntry[];
  /** Rolled-up week status. */
  status: PayrollEntryStatus;
}

/** Supported export formats. */
export type PayrollExportFormat = 'generic_csv' | 'qbo_journal_csv' | 'iif_journal' | 'iif_timeact';

/** Methods every module port provides for the signed-in worker. */
export interface PayrollSelfPort {
  /** List my entries in a range. */
  listEntries(range: PayrollDateRange): Promise<PayrollTimeEntry[]>;
  /** Create or update one of my entries. */
  upsertEntry(entry: PayrollTimeEntry): Promise<void>;
  /** Delete one of my entries. */
  deleteEntry(id: string): Promise<void>;
  /** Submit my entries in a range for approval. */
  submitWeek(range: PayrollDateRange): Promise<void>;
  /** Return an own submitted (not approved) week to draft so it can be edited or deleted. */
  withdrawWeek(range: PayrollDateRange): Promise<void>;
  /** Rate history for me, or for a given user. */
  getRateHistory(userId?: string): Promise<wageEngine.RateChange[]>;
  /** Current payroll settings. */
  getSettings(): Promise<PayrollSettings>;
  /** Computed run lines for my entries in a range. */
  listRunLines(range: PayrollDateRange): Promise<wageEngine.RunLine[]>;
  /** List my reimbursements. */
  listMyReimbursements(): Promise<PayrollReimbursement[]>;
  /** Submit a new reimbursement. */
  submitReimbursement(input: NewReimbursementInput): Promise<void>;
  /** Upload a receipt photo; returns its storage path. */
  uploadReceipt(localUri: string, reimbursementId: string): Promise<string>;
}

/** Admin-only members, present only on the AF port. */
export interface PayrollAdminPort {
  /** List all team weeks in a range. */
  listTeamEntries?(range: PayrollDateRange): Promise<TeamWeek[]>;
  /** Approve a user's week. */
  approveWeek?(userId: string, range: PayrollDateRange): Promise<void>;
  /** Reject a user's week with a reason. */
  rejectWeek?(userId: string, range: PayrollDateRange, reason?: string): Promise<void>;
  /** Admin: delete a user's entries for the week so they can start over. */
  deleteWeek?(userId: string, range: PayrollDateRange): Promise<void>;
  /** Set a user's hourly rate from a date. */
  setRate?(userId: string, hourlyRateCents: number, effectiveFrom: wageEngine.IsoDate): Promise<void>;
  /** Close a payroll run for a range. */
  closeRun?(range: PayrollDateRange): Promise<{ batchId: string }>;
  /** Export a closed run in a format. */
  exportRun?(batchId: string, format: PayrollExportFormat): Promise<wageEngine.CanonicalPayrollExport>;
  /** Read the QuickBooks account map. */
  getQbAccountMap?(): Promise<wageEngine.QbAccountMap>;
  /** Save the QuickBooks account map. */
  setQbAccountMap?(map: wageEngine.QbAccountMap): Promise<void>;
  /** Save payroll settings. */
  saveSettings?(settings: PayrollSettings): Promise<void>;
  /** List every employee's reimbursements. */
  listAllReimbursements?(): Promise<AdminReimbursement[]>;
  /** Resolve a receipt storage path to a viewable URL, or null. */
  getReceiptUrl?(path: string): Promise<string | null>;
}

/** Full port: self members plus optional admin members. */
export type PayrollPort = PayrollSelfPort & PayrollAdminPort;
