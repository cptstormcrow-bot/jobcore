/**
 * Publish-oriented data seam for price sheets (P3i.2a).
 *
 * Interfaces only — NO implementation. This is a distinct, publish-oriented
 * port from `ports.ts`'s `PriceSheetRepository` (read-only listing +
 * `getActive`); this one exists to feed and later apply a `PublishPlan`
 * (`../money/publish-plan.ts`). No sqlite, no fetch, no Supabase client,
 * no React/React Native live here.
 */

import type { PriceSheet, PriceSheetRate, PriceSheetStatus, CalculationResult } from '../money/types';
import type { PublishPlan } from '../money/publish-plan';

/* ------------------------------------------------------------------ *
 * price_sheets row (snake_case) → domain type (camelCase)
 * ------------------------------------------------------------------ */

/**
 * Mirrors the Supabase `price_sheets` table (`app/supabase/0005_money.sql`).
 *
 * VOCABULARY NOTE: the DB `publication_status` enum
 * (`app/supabase/0005_money.sql:11-15`) is `'draft' | 'published' |
 * 'superseded'`, but the app-side `PriceSheetStatus` (`../money/types.ts`)
 * is `'draft' | 'published' | 'archived'` — it uses `'archived'` where the
 * DB uses `'superseded'`. `status` is left `string` here, not
 * `PriceSheetStatus`, because it is untrusted wire data until `toPriceSheet`
 * translates and validates it; the translation belongs in that mapper, not
 * here and not in the RPC caller (P3i.2b).
 */
export interface PriceSheetRow {
  id: string;
  organization_id: string;
  version: number;
  status: string;
  published_at: string | null;
}

type DbPublicationStatus = 'draft' | 'published' | 'superseded';

const DB_TO_APP_STATUS: Readonly<Record<DbPublicationStatus, PriceSheetStatus>> = {
  draft: 'draft',
  published: 'published',
  superseded: 'archived',
};

const DB_PUBLICATION_STATUSES: readonly DbPublicationStatus[] = ['draft', 'published', 'superseded'];

function isDbPriceSheetStatus(value: string): value is DbPublicationStatus {
  return (DB_PUBLICATION_STATUSES as readonly string[]).includes(value);
}

/**
 * Map a `price_sheets` row to the domain `PriceSheet`, translating the DB's
 * `'superseded'` to the app's `'archived'` (see the file-top vocabulary
 * note on `PriceSheetRow`). Throws on an unrecognized status rather than
 * widening the union, matching `ports.ts`'s `toJob` discipline.
 */
export function toPriceSheet(row: PriceSheetRow): PriceSheet {
  if (!isDbPriceSheetStatus(row.status)) {
    throw new Error(`Unknown price sheet status "${row.status}" on price sheet ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    version: row.version,
    status: DB_TO_APP_STATUS[row.status],
    publishedAt: row.published_at,
  };
}

/* ------------------------------------------------------------------ *
 * price_sheet_rates row (snake_case) → domain type (camelCase)
 * ------------------------------------------------------------------ */

/** Mirrors the Supabase `price_sheet_rates` table (`app/supabase/0005_money.sql`). */
export interface PriceSheetRateRow {
  id: string;
  price_sheet_id: string;
  service_id: string;
  attach_timing: string | null;
  amount_cents: number;
}

/** Map a `price_sheet_rates` row to the domain `PriceSheetRate`. */
export function toPriceSheetRate(row: PriceSheetRateRow): PriceSheetRate {
  return {
    id: row.id,
    priceSheetId: row.price_sheet_id,
    serviceId: row.service_id,
    attachTiming: row.attach_timing ?? '',
    amount: row.amount_cents,
  };
}

/* ------------------------------------------------------------------ *
 * Repository port
 * ------------------------------------------------------------------ */

/**
 * Publish-oriented access to price sheets: reads a `PublishPlan`
 * (`../money/publish-plan.ts`'s `planPublish`) needs to be built and
 * validated, plus the write that applies one. Distinct from `ports.ts`'s
 * read-only `PriceSheetRepository` — that port serves listing/active-lookup
 * callers; this one serves the publish flow.
 */
export interface PriceSheetRepo {
  /** All price sheets for the organization, in any status. */
  listForOrganization(organizationId: string): Promise<PriceSheet[]>;

  /** All rate rows belonging to one price sheet. */
  listRates(priceSheetId: string): Promise<PriceSheetRate[]>;

  /**
   * The organization's currently `published` price sheet, if any — this is
   * the value `planPublish`'s `priorPublished` argument expects.
   */
  getPublished(organizationId: string): Promise<PriceSheet | null>;

  /**
   * Applies a `PublishPlan` produced by `planPublish`.
   *
   * The concrete `applyPublishPlanViaRpc` below (P3i.2b) is the
   * `publish_price_sheet` RPC-backed implementation; a `PriceSheetRepo`
   * adapter wires this method to that function.
   */
  applyPublishPlan(organizationId: string, plan: PublishPlan): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * applyPublishPlan — Supabase RPC implementation (P3i.2b)
 * ------------------------------------------------------------------ */

/**
 * Minimal shape of the Supabase client surface this file depends on — just
 * `rpc`, not the full `SupabaseClient` type, so this module stays free of a
 * hard `@supabase/supabase-js` import.
 */
export interface SupabaseRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Applies a `PublishPlan` (`../money/publish-plan.ts`'s `planPublish`) by
 * invoking the `publish_price_sheet(uuid)` RPC (`app/supabase/0005_money.sql`,
 * line 395). The RPC re-derives the organization's prior-published sheet and
 * performs the demote/promote pair itself, inside one `security definer`
 * transaction — it only needs the draft's id
 * (`plan.toPublish.priceSheetId`), never the plan's full contents, and
 * `organizationId` is not passed either: the RPC scopes to
 * `public.current_org_id()` from the caller's session.
 *
 * VOCABULARY NOTE: the RPC body is what writes the DB `publication_status`
 * enum value `'superseded'` (never the app-side `'archived'` — see the
 * file-top note on `PriceSheetRow`) when it demotes the prior published
 * sheet. That write happens entirely server-side inside the RPC; no
 * argument passed from this function ever carries `'superseded'` or
 * `'archived'`.
 *
 * Returns a `CalculationResult<void>` rather than throwing, matching every
 * other failable function in `money/` (`CalculationResult`, `../money/types.ts`).
 */
export async function applyPublishPlanViaRpc(
  client: SupabaseRpcClient,
  plan: PublishPlan,
): Promise<CalculationResult<void>> {
  const { error } = await client.rpc('publish_price_sheet', {
    p_price_sheet_id: plan.toPublish.priceSheetId,
  });
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: undefined };
}
