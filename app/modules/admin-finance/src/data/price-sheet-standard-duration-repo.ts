/**
 * Repo layer for `price_sheet_standard_duration` (T21).
 *
 * Mirrors the Supabase `price_sheet_standard_duration` table
 * (`app/supabase/migrations/0047_price_sheet_standard_duration.sql`): an org-scoped
 * singleton row (`organization_id` is itself the primary key) holding the
 * baseline/standard job duration compared against real price-sheet-sourced
 * job durations.
 *
 * Follows the same `CalculationResult`-free / plain-return convention as
 * this file's siblings' simplest read+write pair (`listServiceTasks` /
 * `saveServiceTask` in `price-sheet-repo.ts`), returning
 * `CalculationResult<...>` to match every other failable function in this
 * module.
 */

import type { CalculationResult } from '../money/types';
import type { PriceSheetStandardDuration } from './ports';

/** Mirrors the Supabase `price_sheet_standard_duration` table. */
export interface PriceSheetStandardDurationRow {
  organization_id: string;
  standard_minutes: number;
  updated_at: string;
}

/** Map a `price_sheet_standard_duration` row to the domain type (`ports.ts`). */
export function toPriceSheetStandardDuration(
  row: PriceSheetStandardDurationRow
): PriceSheetStandardDuration {
  return {
    organizationId: row.organization_id,
    standardMinutes: row.standard_minutes,
    updatedAt: row.updated_at,
  };
}

// Minimal client seam matching the real Supabase query-builder's chainable
// shape, same pattern as SupabaseAreaAdjustmentsClient / SupabaseServiceTasksClient
// in price-sheet-repo.ts.
interface SupabaseStandardDurationClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export async function getStandardDuration(
  client: SupabaseStandardDurationClient,
  organizationId: string
): Promise<CalculationResult<PriceSheetStandardDuration | null>> {
  const { data, error } = await client
    .from('price_sheet_standard_duration')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: data ? toPriceSheetStandardDuration(data) : null };
}

export async function upsertStandardDuration(
  client: SupabaseStandardDurationClient,
  organizationId: string,
  standardMinutes: number
): Promise<CalculationResult<PriceSheetStandardDuration>> {
  const { data, error } = await client
    .from('price_sheet_standard_duration')
    .upsert(
      {
        organization_id: organizationId,
        standard_minutes: standardMinutes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )
    .select('*')
    .single();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toPriceSheetStandardDuration(data) };
}
