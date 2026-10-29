/**
 * Pure (RN-free) helpers for the Sync issues screen: turn an offline-queue
 * op type into plain language.
 */

const OP_LABELS: Record<string, string> = {
  'job_time_entry.clock_in': 'Clock in',
  'job_time_entry.clock_out': 'Clock out',
  'job_photo.create': 'Job photo',
  'job_photo.note': 'Photo note',
  'job_photo.remove': 'Remove job photo',
  'job_planning_photo.add': 'Planning photo',
  'job_planning_photo.remove': 'Remove planning photo',
  'job_note.create': 'Note',
  'job_note.upsert': 'Note',
  'checklist_instance.create': 'Checklist',
  'checklist_instance.submit': 'Checklist submission',
  'time_off_request.create': 'Time-off request',
  'time_off_request.cancel': 'Cancel time-off request',
  'time_off_request.update': 'Time-off request change',
  'time_off_request.create_blackout': 'Blackout day',
  'time_off_request.admin_cancel': 'Cancel time-off request',
  'job_assignment.claim': 'Claim job',
  'job_assignment.create': 'Job assignment',
  'job_assignment.remove_investigator': 'Remove investigator',
  'job_assignment.remove_for_job': 'Remove assignment',
  'job.create': 'New job',
  'job.updateStatusAsTech': 'Job status change',
  'job.update_status': 'Job status change',
  'job.patch_lifecycle': 'Job update',
  'job.patch_scheduling': 'Job scheduling',
  'job.update_details': 'Job details',
  'job.mark_contacted': 'Customer contacted',
  'job.mark_beta': 'Job beta flag',
  'job.set_needs_prem': 'Job Prem flag',
  'job.reset_timeline': 'Reset job timeline',
  'job_investigation.upsert': 'Investigation',
  'job_estimate.upsert': 'Estimate',
  'job_estimate_line_item.add': 'Estimate line item',
  'calendar_event.create': 'Calendar event',
  'reimbursement.create': 'Reimbursement',
  'audit_log.write': 'Activity log entry',
  'payroll_time.upsert': 'Payroll time entry',
  'payroll_time.delete': 'Delete payroll time entry',
  'payroll_timesheet.submit': 'Timesheet submission',
  'payroll_timesheet.withdraw': 'Timesheet withdrawal',
  'lead.create': 'New lead',
  'lead.update': 'Lead update',
  'lead.mark_qualified': 'Lead qualified',
  'customer.create': 'New customer',
  'customer.update': 'Customer update',
  'job_customer.save': 'Job customer',
  'job_contact_log.create': 'Contact log entry',
  'job_planning.upsert': 'Job planning',
  'payout_batch.approve': 'Approve payout batch',
  'payout_batch.mark_paid': 'Mark payout batch paid',
  'payment.record_manual': 'Manual payment',
};

const ENTITY_LABELS: Record<string, string> = {
  employee: 'Employee',
  profile: 'Profile',
  invitation: 'Invitation',
  tech_service_area: 'Service area',
  tech_skill: 'Skill',
  job_plan_task: 'Plan task',
  price_sheet: 'Price sheet',
  price_sheet_rate: 'Price sheet rate',
  price_sheet_area_adjustment: 'Area adjustment',
  price_sheet_standard_duration: 'Standard duration',
  service_task: 'Service task',
  close_out_failure: 'Close-out failure',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'added',
  add: 'added',
  update: 'changed',
  upsert: 'saved',
  delete: 'deleted',
  remove: 'removed',
  assign: 'assigned',
  update_quantity: 'quantity changed',
  defer: 'deferred',
  deactivate: 'deactivated',
  reactivate: 'reactivated',
  revoke: 'revoked',
  update_name: 'name changed',
};

function sentence(s: string): string {
  const t = s.replace(/[._]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Plain-language name for a queued op type, e.g. 'job_time_entry.clock_out' -> 'Clock out'. */
export function opLabel(op: string): string {
  const known = OP_LABELS[op];
  if (known) return known;
  const dot = op.indexOf('.');
  if (dot > 0) {
    const entity = ENTITY_LABELS[op.slice(0, dot)];
    const action = ACTION_LABELS[op.slice(dot + 1)];
    if (entity && action) return `${entity} ${action}`;
  }
  return op ? sentence(op) : 'Change';
}

/** "Saved Oct 29, 2026, 3:04 PM" style text from an ISO timestamp; falls back to the raw value. */
export function savedAtLabel(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ? `Saved ${iso}` : 'Saved on this device';
  const text = d.toLocaleString(locale ?? 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Saved ${text}`;
}

/** Plain error text for a failed row. */
export function failureMessage(lastError: string | null | undefined): string {
  const t = (lastError ?? '').trim();
  return t || 'This change could not be sent. No error details were recorded.';
}
