/**
 * DateRangeCalendar — date-range picker for `TimeOff.tsx` (Workstream F, 4a),
 * now sharing the same `CalendarHeader` / `WeekView` / `MonthView` primitives
 * as the Jobs calendar (`@jobcore/ui`) so the two calendars look identical.
 *
 * Controlled component: the parent (`TimeOff.tsx`) owns `startDate`/
 * `endDate` as ISO `YYYY-MM-DD` strings and passes `onChangeStartDate`/
 * `onChangeEndDate`. Tap behavior: the first tap (or a tap before the
 * current start) sets the start date and clears the end date; the next
 * tap sets the end date (swapping if it lands before the new start).
 */
import * as React from 'react';
export interface DateRangeCalendarProps {
    /** ISO `YYYY-MM-DD`, or empty string when unset. */
    startDate: string;
    /** ISO `YYYY-MM-DD`, or empty string when unset. */
    endDate: string;
    onChangeStartDate: (value: string) => void;
    onChangeEndDate: (value: string) => void;
    disabled?: boolean;
    markedRanges?: {
        id: string;
        startDate: string;
        endDate: string;
    }[];
    onSelectMarkedDay?: (id: string) => void;
    /** Fires after any non-marked day tap once start/end have been updated. */
    onDayTapped?: (day: Date) => void;
}
export declare function DateRangeCalendar({ startDate, endDate, onChangeStartDate, onChangeEndDate, disabled, markedRanges, onSelectMarkedDay, onDayTapped, }: DateRangeCalendarProps): React.ReactElement;
//# sourceMappingURL=DateRangeCalendar.d.ts.map