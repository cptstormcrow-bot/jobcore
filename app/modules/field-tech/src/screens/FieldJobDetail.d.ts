/**
 * FieldJobDetail — module-local job detail screen (P4.S3.3).
 *
 * This is NOT `apps/mobile`'s shared `JobDetail.tsx`. field-tech's isolation
 * rule forbids importing anything from `apps/mobile`, so this screen is
 * self-contained: it only depends on this module's own data seam
 * (`../data/ports`) and session/port plumbing (`../lib/module-session`,
 * `../lib/module-ports`), mirroring `modules/admin-finance/src`'s layering.
 *
 * ZERO financial fields. This screen must never render anything sourced
 * from `price_sheets`, commissions, or payout data — grep-checked in S5.5.
 * If a job record happens to carry a financial field, it is simply never
 * read here.
 *
 * Ties to spec AC9.
 */
import * as React from 'react';
/** Props for `FieldJobDetail`. `jobId` selects the job; the rest is resolved via ports. */
export interface FieldJobDetailProps {
    jobId: string;
    /**
     * Customer phone number for tap-to-call. Not part of the `jobs` row
     * (see `../data/ports.ts`'s `JobRow`) — supplied by the caller from
     * wherever customer contact info is sourced, so this screen never has
     * to reach outside its own data seam to get it.
     */
    customerPhone?: string | null;
}
/**
 * Module-local job detail screen. Shows requested vs scheduled timing
 * distinctly, tap-to-call / tap-to-map actions, and read-only admin notes.
 * Renders nothing financial.
 */
export declare function FieldJobDetail({ jobId, customerPhone }: FieldJobDetailProps): React.ReactElement;
//# sourceMappingURL=FieldJobDetail.d.ts.map