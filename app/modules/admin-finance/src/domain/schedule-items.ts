/**
 * Pure shaping for the job Schedule screen's calendar (Calendar Redux, slice S5).
 *
 * Turns jobs + time-off requests + employees into picker items and popup details.
 * No react / react-native / @jobcore/ui: the types below are structurally identical
 * to the UI package's SchedulePickerItem / ScheduleItemDetail, so the screen passes
 * these arrays straight through without a cross-package import.
 */

import type { Job, JobStatus } from '@jobcore/core';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';

export type ScheduleItem = {
  id: string;
  kind: 'job' | 'blackout';
  startIso: string;
  endIso: string | null;
  title: string;
  subtitle?: string;
  isCurrent?: boolean;
};

export type ScheduleDetail = {
  kind: 'job' | 'blackout';
  title: string;
  whenLabel: string;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  openJobId?: string | null;
};

/**
 * The ONE list of job statuses that never appear on the schedule calendar.
 * Real JobStatus names (packages/core/src/index.ts; state-machine.ts):
 * cancelled and archived are the cancel/archive markers (archive is a status, there
 * is no separate flag); closed and declined are terminal (no outgoing transition);
 * paid and completed are finished work, no longer a schedule commitment.
 */
export const UNSCHEDULABLE_JOB_STATUSES: readonly JobStatus[] = [
  'cancelled',
  'archived',
  'closed',
  'declined',
  'paid',
  'completed',
];

function isValidDate(value: string | null | undefined): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function isSchedulableJob(job: Pick<Job, 'status' | 'scheduledStart'>): boolean {
  if (!isValidDate(job.scheduledStart)) return false;
  return !UNSCHEDULABLE_JOB_STATUSES.includes(job.status);
}

function jobNumberLabel(job: Pick<Job, 'jobNumber'>): string {
  return job.jobNumber != null ? `Job #${job.jobNumber}` : 'Job';
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export type ScheduleEmployee = { id: string; fullName: string };

/**
 * Date-only blackout values ("YYYY-MM-DD") become local midnight of the first day
 * (start) and local midnight of the day AFTER the last day (end), so a one-day
 * blackout covers exactly its own day. Returns null when the value is unparseable.
 */
function localDayIso(dateOnly: string, plusDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOnly);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + plusDays);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(dateOnly);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + plusDays);
  return d.toISOString();
}

export function buildScheduleItems(args: {
  jobs: readonly Job[];
  timeOff: readonly TimeOffRequestAdmin[];
  employees: readonly ScheduleEmployee[];
  currentJobId?: string | null;
}): ScheduleItem[] {
  const { jobs, timeOff, employees, currentJobId } = args;
  const items: ScheduleItem[] = [];

  for (const job of jobs) {
    if (!isSchedulableJob(job)) continue;
    const start = new Date(job.scheduledStart as string).toISOString();
    const end = isValidDate(job.scheduledEnd) ? new Date(job.scheduledEnd).toISOString() : null;
    const name = clean(job.customerName);
    const item: ScheduleItem = {
      id: `job:${job.id}`,
      kind: 'job',
      startIso: start,
      endIso: end,
      title: name ? `${jobNumberLabel(job)} - ${name}` : jobNumberLabel(job),
    };
    const address = clean(job.address);
    if (address) item.subtitle = address;
    if (currentJobId != null && job.id === currentJobId) item.isCurrent = true;
    items.push(item);
  }

  const nameById = new Map<string, string>();
  for (const e of employees) nameById.set(e.id, e.fullName);

  for (const request of timeOff) {
    // Same filter as UniversalCalendar.toCalendarTimeOffEvents.
    if (request.status === 'cancelled' || request.status === 'denied') continue;
    const start = localDayIso(request.startDate, 0);
    const end = localDayIso(request.endDate, 1);
    if (start === null || end === null) continue;
    const name = clean(nameById.get(request.techId)) ?? 'Unknown tech';
    items.push({
      id: `blackout:${request.id}`,
      kind: 'blackout',
      startIso: start,
      endIso: end,
      title: `${name} - Blackout`,
    });
  }

  items.sort((a, b) => (a.startIso < b.startIso ? -1 : a.startIso > b.startIso ? 1 : 0));
  return items;
}

export function scheduleItemRef(id: string): { kind: 'job' | 'blackout'; ref: string } | null {
  for (const kind of ['job', 'blackout'] as const) {
    const prefix = `${kind}:`;
    if (id.startsWith(prefix) && id.length > prefix.length) {
      return { kind, ref: id.slice(prefix.length) };
    }
  }
  return null;
}

export function jobScheduleDetail(
  job: Pick<Job, 'id' | 'jobNumber' | 'customerName' | 'customerPhone' | 'address' | 'description'>,
  whenLabel: string,
): ScheduleDetail {
  return {
    kind: 'job',
    title: clean(job.customerName) ?? jobNumberLabel(job),
    whenLabel,
    address: clean(job.address),
    phone: clean(job.customerPhone),
    description: clean(job.description),
    openJobId: job.id,
  };
}

export function blackoutScheduleDetail(
  request: Pick<TimeOffRequestAdmin, 'reason'>,
  employeeName: string | null | undefined,
  whenLabel: string,
): ScheduleDetail {
  const detail: ScheduleDetail = {
    kind: 'blackout',
    title: clean(employeeName) ?? 'Unknown',
    whenLabel,
  };
  const reason = clean(request.reason);
  if (reason) detail.description = reason;
  return detail;
}
