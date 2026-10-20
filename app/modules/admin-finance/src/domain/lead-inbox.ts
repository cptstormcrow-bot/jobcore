/**
 * Lead inbox selection (P3e.5).
 *
 * Pure function separating "which leads does the inbox show, and in what
 * order" from `LeadInboxScreen.tsx`'s data-loading/rendering concerns, so
 * it is testable with plain `node:test` — no React Native renderer needed.
 *
 * Filters to unconverted leads only (`convertedJobId === null`). Never
 * filters by readiness — an incomplete (`needs_info`) lead is first-class
 * and appears like any other: no badge, no hidden rows, and defaults are
 * never fabricated (`03-P3-admin-finance.md` lines 48-53).
 */

import type { Lead } from './lead';

/** Unconverted leads, newest first by `createdAt`. Never hides a lead. */
export function selectInboxLeads(leads: readonly Lead[]): Lead[] {
  return leads
    .filter((lead) => lead.convertedJobId === null)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
