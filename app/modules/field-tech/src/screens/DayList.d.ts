/**
 * DayList screen for the field-tech module (P4.S3.2).
 *
 * Renders the signed-in tech's jobs for the day. Scoping is PURELY via
 * Supabase RLS — this screen does NOT add any client-side role/tech filter
 * on top of the query. `TechJobRepository.listAssignedToTech` is called
 * with the session's own `userId`; RLS on the `jobs`/`job_assignments`
 * tables (see `0007_field_tech_tables.sql` comments referenced in
 * `data/ports.ts`) is what actually restricts the result set to jobs
 * assigned to this tech. Ties to spec AC1, VS1.
 *
 * Mirrors `modules/admin-finance/src` layering: screen reads session +
 * ports via the module seams, never constructs a repository itself.
 *
 * Also renders a "This Week" strip below the today list — a `WeekView`
 * (from `@jobcore/ui`) fed the same assigned-jobs list plus this tech's
 * own active time-off requests, expanded day-by-day into `TimeOffEvent`s
 * the same way `AdminFinanceRoot.toCalendarTimeOffEvents` does for the
 * admin calendar.
 */
import React from 'react';
import type { Job } from '@jobcore/core';
import { type TimeOffEvent } from '@jobcore/ui';
import { type TimeOffRequest } from '../data/ports';
/** Props for `DayList`. */
export interface DayListProps {
    /**
     * Optional row-selection callback. When provided, each job row becomes
     * pressable and invokes this with the tapped job. When omitted, rows
     * remain non-interactive — no behavior change for existing callers.
     */
    onSelectJob?: (job: Job) => void;
    /** Opens the given job (today list + week strip job cards). */
    onOpenJob?: (jobId: string) => void;
    /** Opens the given time-off entry (week strip time-off cards). */
    onOpenTimeOff?: (event: TimeOffEvent) => void;
    /**
     * Optional tech id override — when provided (admin viewing a specific
     * tech), scopes the fetch to this tech instead of the signed-in
     * session's own userId.
     */
    techId?: string;
}
/**
 * True when `job.scheduledStart` falls on the same LOCAL calendar date as
 * `today`. A job with no `scheduledStart` is never "today".
 */
export declare function isScheduledOnLocalDate(job: Job, today: Date): boolean;
/**
 * Expands each active (`pending` | `approved`) `TimeOffRequest` — spanning a
 * `startDate`/`endDate` range — into one `TimeOffEvent` per calendar day in
 * range. Mirrors `AdminFinanceRoot.toCalendarTimeOffEvents`, minus the
 * admin-only tech-name lookup (this list is always the signed-in tech's own
 * requests).
 */
export declare function expandTimeOffToEvents(requests: TimeOffRequest[], now?: Date): TimeOffEvent[];
export declare function DayList({ onSelectJob, onOpenJob, onOpenTimeOff, techId }?: DayListProps): React.ReactElement;
//# sourceMappingURL=DayList.d.ts.map