// supabase/functions/price-sheet-current/handler.ts
//
// PURE transformation logic for the price-sheet-current public feed. Zero
// Deno/DB/network imports so this file is portable to plain Node — it is
// imported both by the Deno index.ts transport at deploy time and by the
// Node fixture test in __assertions__/build-feed.assert.ts.
//
// Row shapes below mirror the `price_sheets` / `price_sheet_rates` table
// definitions in supabase/0005_money.sql exactly (column names/types).

/** Mirrors public.publication_status (0005_money.sql). */
export type PublicationStatus = 'draft' | 'published' | 'superseded';

/** Mirrors the price_sheet_rates.attach_timing CHECK constraint (0005_money.sql). */
export type AttachTiming = 'at_purchase' | 'after_the_fact' | 'before_start' | null;

/** A row from public.price_sheets (0005_money.sql), fields relevant to the feed. */
export interface PriceSheetRow {
  id: string;
  organization_id: string;
  version: number;
  effective_from: string | null;
  published_at: string | null;
  status: PublicationStatus;
}

/** A row from public.price_sheet_rates (0005_money.sql), fields relevant to the feed. */
export interface PriceSheetRateRow {
  price_sheet_id: string;
  service_id: string;
  attach_timing: AttachTiming;
  amount_cents: number;
}

/** One published rate line in the public feed body. */
export interface FeedRate {
  service_id: string;
  attach_timing: AttachTiming;
  amount_cents: number;
}

/** The public price-feed body returned by GET /price-sheet-current. */
export interface FeedBody {
  organization_id: string;
  version: number;
  effective_from: string;
  published_at: string;
  rates: FeedRate[];
}

/**
 * Builds the public feed body from raw `price_sheets` / `price_sheet_rates`
 * rows. Selects ONLY the published sheet (status = 'published', per
 * public.publication_status) and only that sheet's rates — no side effects,
 * no I/O. Returns null when there is no published sheet in `sheets`.
 */
export function buildFeed(
  sheets: PriceSheetRow[],
  rates: PriceSheetRateRow[],
): FeedBody | null {
  const publishedSheet = sheets.find((s) => s.status === 'published');
  if (!publishedSheet) return null;

  const publishedRates = rates.filter((r) => r.price_sheet_id === publishedSheet.id);

  return {
    organization_id: publishedSheet.organization_id,
    version: publishedSheet.version,
    effective_from: publishedSheet.effective_from ?? '',
    published_at: publishedSheet.published_at ?? '',
    rates: publishedRates.map((r) => ({
      service_id: r.service_id,
      attach_timing: r.attach_timing,
      amount_cents: r.amount_cents,
    })),
  };
}
