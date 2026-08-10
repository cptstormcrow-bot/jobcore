/**
 * Published price-sheet feed document builder (P7 Slice A).
 *
 * Produces the read-only, publish-oriented document the website's pricing
 * page consumes — a flat list of `{ serviceName, attachTiming, amount }`
 * rows, never the raw `PriceSheet`/`PriceSheetRate` row shapes. Fails
 * closed (returns `{ ok: false }`) whenever the sheet is not `'published'`,
 * matching every other failable function in `money/` (`CalculationResult`,
 * `../money/types.ts`) — an unpublished sheet must never leak to a
 * website-facing feed.
 */

import type { PriceSheet, PriceSheetRate, CalculationResult } from '../money/types';

/** One row of the published feed document — service name, not id, so the website needs no separate lookup. */
export interface PriceSheetFeedRow {
  serviceId: string;
  serviceName: string;
  attachTiming: string;
  amount: number;
}

/** The document `toPriceSheetFeedDocument` returns on success. */
export interface PriceSheetFeedDocument {
  priceSheetId: string;
  organizationId: string;
  version: number;
  publishedAt: string | null;
  rows: readonly PriceSheetFeedRow[];
}

/**
 * Builds the website-facing feed document for one price sheet.
 *
 * Fails closed with `{ ok: false, reason }` when:
 * - `sheet.status !== 'published'` (the sheet is a draft or archived —
 *   never feed anything but the currently published sheet), or
 * - any rate names a `serviceId` missing from `serviceNames` (a data
 *   integrity gap — better to fail the whole feed than publish a row with
 *   no name).
 *
 * `serviceNames` is a caller-supplied `serviceId -> name` map because this
 * module has no DB/fetch access of its own (interfaces-only data seam
 * discipline, matching `price-sheet-repo.ts`).
 */
export function toPriceSheetFeedDocument(
  sheet: PriceSheet,
  rates: readonly PriceSheetRate[],
  serviceNames: ReadonlyMap<string, string>,
): CalculationResult<PriceSheetFeedDocument> {
  if (sheet.status !== 'published') {
    return { ok: false, reason: `Price sheet ${sheet.id} is not published (status: ${sheet.status})` };
  }

  const rows: PriceSheetFeedRow[] = [];
  for (const rate of rates) {
    const serviceName = serviceNames.get(rate.serviceId);
    if (serviceName === undefined) {
      return { ok: false, reason: `No service name found for service ${rate.serviceId}` };
    }
    rows.push({
      serviceId: rate.serviceId,
      serviceName,
      attachTiming: rate.attachTiming,
      amount: rate.amount,
    });
  }

  return {
    ok: true,
    value: {
      priceSheetId: sheet.id,
      organizationId: sheet.organizationId,
      version: sheet.version,
      publishedAt: sheet.publishedAt,
      rows,
    },
  };
}
