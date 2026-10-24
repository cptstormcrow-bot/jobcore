/**
 * Wage-engine shared types. Pure data: no I/O, no clock, no Supabase.
 *
 * Conventions used by every wage-engine module:
 *  - minutes are integers (never fractional hours);
 *  - dates are calendar dates as 'YYYY-MM-DD' strings (never instants, so there
 *    is no timezone drift in day / week / month bucketing);
 *  - money is integer cents, and wages are rounded once per run line.
 */

/** A calendar date, 'YYYY-MM-DD'. */
export type IsoDate = string;

/** Org-level overtime switches (payroll_settings, migration 0080). */
export interface OvertimeConfig {
  /** Daily minutes above which time is paid at 1.5x. Default 480 (8h). */
  dailyOtAfterMin: number;
  /** Daily minutes above which time is paid at 2x. Default 720 (12h). */
  dailyDtAfterMin: number;
  /** Weekly regular minutes above which time is paid at 1.5x. Default 2400 (40h). */
  weeklyOtAfterMin: number;
  /** California 7th consecutive day of a workweek: first 8h at 1.5x, beyond 8h at 2x. */
  seventhDayRule: boolean;
}

/** Weekly pay calendar (payroll_settings, migration 0080). */
export interface PayWeekConfig {
  /** 0 = Sunday ... 6 = Saturday. */
  weekStartDow: number;
  /** Anchor date of a known pay week; kept for display and future period types. */
  anchorDate: IsoDate;
}

/** Worked minutes for one calendar day, already summed across that day's entries. */
export interface WorkedDay {
  workDate: IsoDate;
  minutes: number;
}

/** Minutes split by pay multiplier: regular 1x, ot 1.5x, dt 2x. */
export interface MinuteBuckets {
  regularMin: number;
  otMin: number;
  dtMin: number;
}

export interface DayAllocation extends MinuteBuckets {
  workDate: IsoDate;
  /** True when this day was the 7th consecutive worked day of its workweek. */
  seventhDay: boolean;
}

export interface WeekAllocation {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  days: DayAllocation[];
  totals: MinuteBuckets;
}

/** One row of employee_rate_history. */
export interface RateChange {
  effectiveFrom: IsoDate;
  hourlyRateCents: number;
}

/** Minutes worked at one hourly rate; a run line carries one segment per rate in force. */
export interface RateSegment extends MinuteBuckets {
  hourlyRateCents: number;
}

export type RollupGranularity = 'day' | 'week' | 'month' | 'year';

export interface RollupRow extends MinuteBuckets {
  granularity: RollupGranularity;
  /** 'YYYY-MM-DD' (day), week-start date (week), 'YYYY-MM' (month), 'YYYY' (year). */
  key: string;
  totalMin: number;
}

/** One employee's pay for one batch; maps onto one payout_lines row (migration 0084). */
export interface RunLine {
  userId: string;
  employeeName: string;
  regularMin: number;
  otMin: number;
  dtMin: number;
  segments: RateSegment[];
  /** Wages, rounded once for the whole line; payout_lines.hours_amount. */
  grossCents: number;
  /** Approved reimbursements; payout_lines.reimbursement_amount. */
  reimbursementCents: number;
  /** Posted per-job pay (Dev flat / Prem bonus); payout_lines.bonus_amount. Absent = 0. */
  bonusCents?: number;
  /** grossCents + bonusCents + reimbursementCents. */
  totalCents: number;
}

/** Format-neutral export document; every formatter (CSV, QBO journal, IIF) consumes this. */
export interface CanonicalPayrollExport {
  batchId: string;
  /** Stable hash of the lines, so a re-export of unchanged data is recognisable. */
  sourceHash: string;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  lines: RunLine[];
}

export type QbAccountKey = 'wages_expense' | 'reimbursement_expense' | 'payroll_payable';

/** Per-org QuickBooks account names (payroll_qb_account_map, migration 0085). */
export type QbAccountMap = Record<QbAccountKey, string>;
