/**
 * Bonus SEAM (P3-c.4). Jeff has not specified a bonus formula/policy —
 * this file deliberately implements NO arithmetic that produces a
 * non-zero bonus. `NullBonusRule` is the default and always returns
 * zero. Plugging in a real formula (percentage, threshold, tier table,
 * per-job kicker, etc.) requires Jeff's explicit sign-off; do not add
 * one speculatively.
 */
import type { BonusResult } from './types';
import type { Job, Profile } from '@jobcore/core';

/**
 * A pluggable bonus policy: given a pay period, a tech, and the jobs
 * attributed to them in that period, produce a `BonusResult`. Pure —
 * no global, no clock, no async, no I/O (AC-8).
 */
export interface BonusRule {
  evaluate(period: { start: string; end: string }, tech: Profile, jobs: Job[]): BonusResult;
}

/**
 * The default bonus rule: no bonus policy is configured, so it always
 * returns a zero-amount result with a human-readable explanation.
 */
export const NullBonusRule: BonusRule = {
  evaluate(_period, _tech, _jobs): BonusResult {
    return {
      amount: 0,
      rule: 'NullBonusRule',
      explanation: 'No bonus policy is configured for this organization; a zero bonus is applied by default.',
    };
  },
};
