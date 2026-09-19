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
import type { ServiceTask } from './ports';

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

export interface PriceSheetAreaAdjustmentRow {
  id: string;
  price_sheet_id: string;
  service_area_id: string;
  adjustment_type: string;
  adjustment_value: number;
  created_at: string;
  updated_at: string;
}

export interface PriceSheetAreaAdjustment {
  id: string;
  priceSheetId: string;
  serviceAreaId: string;
  adjustmentType: 'percent' | 'flat';
  adjustmentValue: number;
  createdAt: string;
  updatedAt: string;
}

function isAreaAdjustmentType(value: string): value is 'percent' | 'flat' {
  return value === 'percent' || value === 'flat';
}

export function toPriceSheetAreaAdjustment(row: PriceSheetAreaAdjustmentRow): PriceSheetAreaAdjustment {
  if (!isAreaAdjustmentType(row.adjustment_type)) {
    throw new Error(`Unrecognized adjustment_type: ${row.adjustment_type}`);
  }
  return {
    id: row.id,
    priceSheetId: row.price_sheet_id,
    serviceAreaId: row.service_area_id,
    adjustmentType: row.adjustment_type,
    adjustmentValue: row.adjustment_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

// Minimal client seam matching the real Supabase query-builder's chainable
// shape without importing @supabase/supabase-js's generics here (see
// SupabaseRpcClient above).
interface SupabaseAreaAdjustmentsClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export async function listAreaAdjustments(
  client: SupabaseAreaAdjustmentsClient,
  priceSheetId: string
): Promise<CalculationResult<PriceSheetAreaAdjustment[]>> {
  const { data, error } = await client
    .from('price_sheet_area_adjustments')
    .select('*')
    .eq('price_sheet_id', priceSheetId);
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: (data ?? []).map(toPriceSheetAreaAdjustment) };
}

export async function saveAreaAdjustment(
  client: SupabaseAreaAdjustmentsClient,
  priceSheetId: string,
  serviceAreaId: string,
  adjustmentType: 'percent' | 'flat',
  adjustmentValue: number
): Promise<CalculationResult<PriceSheetAreaAdjustment>> {
  const { data: sheet, error: sheetError } = await client
    .from('price_sheets')
    .select('organization_id')
    .eq('id', priceSheetId)
    .single();
  if (sheetError || !sheet) {
    return { ok: false, reason: sheetError?.message ?? 'Price sheet not found.' };
  }
  const { data, error } = await client
    .from('price_sheet_area_adjustments')
    .upsert(
      {
        price_sheet_id: priceSheetId,
        service_area_id: serviceAreaId,
        adjustment_type: adjustmentType,
        adjustment_value: adjustmentValue,
        organization_id: sheet.organization_id,
      },
      { onConflict: 'price_sheet_id,service_area_id' }
    )
    .select('*')
    .single();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toPriceSheetAreaAdjustment(data) };
}

/* ------------------------------------------------------------------ *
 * price_sheet_rates row (with joined task) → domain type (camelCase)
 * ------------------------------------------------------------------ */

/**
 * Mirrors `price_sheet_rates` joined with its optional `service_tasks` row
 * (Slice D task-level pricing). `task_id` and `estimated_minutes` are the
 * task-pricing columns (`estimated_minutes` added by migration 0024;
 * `task_id` is a forward-referenced column this repo assumes but no
 * migration has added yet — see build report Deviations); `service_tasks`
 * is the optional embedded join Supabase returns when the caller selects
 * it.
 */
export interface PriceSheetRateWithTaskRow {
  id: string;
  price_sheet_id: string;
  service_id: string;
  task_id: string | null;
  attach_timing: string | null;
  amount_cents: number;
  estimated_minutes: number | null;
  service_tasks?: { name: string } | null;
}

/**
 * Map a `price_sheet_rates` (+ joined `service_tasks`) row to the domain
 * `PriceSheetRate`, widened with the task-pricing fields (`taskId`,
 * `timeEstimateMinutes`, `taskName`) that `PriceSheetRate` itself doesn't
 * declare (`../money/types.ts`) but every caller of this mapper needs.
 */
export function toPriceSheetRateWithTask(
  row: PriceSheetRateWithTaskRow
): PriceSheetRate & { taskId: string | null; timeEstimateMinutes: number | null; taskName: string | null } {
  return {
    id: row.id,
    priceSheetId: row.price_sheet_id,
    serviceId: row.service_id,
    attachTiming: row.attach_timing ?? '',
    amount: row.amount_cents,
    taskId: row.task_id,
    timeEstimateMinutes: row.estimated_minutes,
    taskName: row.service_tasks?.name ?? null,
  };
}

// Minimal client seam matching the real Supabase query-builder's chainable
// shape, same pattern as SupabaseAreaAdjustmentsClient above.
interface SupabaseRatesClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export async function saveRate(
  client: SupabaseRatesClient,
  priceSheetId: string,
  serviceId: string,
  taskId: string | null,
  attachTiming: string,
  amount: number,
  timeEstimateMinutes: number | null
): Promise<CalculationResult<PriceSheetRate>> {
  const { data, error } = await client
    .from('price_sheet_rates')
    .upsert(
      {
        price_sheet_id: priceSheetId,
        service_id: serviceId,
        task_id: taskId,
        attach_timing: attachTiming,
        amount_cents: amount,
        estimated_minutes: timeEstimateMinutes,
      },
      { onConflict: 'price_sheet_id,service_id,attach_timing' }
    )
    .select('*')
    .single();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toPriceSheetRate(data) };
}

export async function deleteRate(
  client: SupabaseRatesClient,
  rateId: string
): Promise<CalculationResult<void>> {
  const { error } = await client.from('price_sheet_rates').delete().eq('id', rateId);
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: undefined };
}

/* ------------------------------------------------------------------ *
 * service_tasks row (snake_case) → domain type (camelCase)
 * ------------------------------------------------------------------ */

/** Mirrors the Supabase `service_tasks` table (`app/supabase/0032_price_sheet_task_pricing.sql`). */
export interface ServiceTaskRow {
  id: string;
  organization_id: string;
  service_id: string;
  name: string;
  estimated_minutes?: number | null;
  rate?: number | null;
  category?: string | null;
  active?: boolean;
  price_cents?: number | null;
  details?: string | null;
  materials?: string | null;
}

/** Map a `service_tasks` row to the domain `ServiceTask` (`../data/ports.ts`). */
export function toServiceTask(row: ServiceTaskRow): ServiceTask {
  return {
    id: row.id,
    organizationId: row.organization_id,
    serviceId: row.service_id,
    name: row.name,
    estimatedMinutes: row.estimated_minutes ?? null,
    rate: row.rate ?? null,
    category: row.category ?? null,
    active: row.active ?? true,
    priceCents: row.price_cents ?? null,
    details: row.details ?? null,
    materials: row.materials ?? null,
  };
}

// Minimal client seam matching the real Supabase query-builder's chainable
// shape, same pattern as SupabaseAreaAdjustmentsClient above.
interface SupabaseServiceTasksClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export async function listServiceTasks(
  client: SupabaseServiceTasksClient,
  organizationId: string,
  serviceId?: string
): Promise<CalculationResult<ServiceTask[]>> {
  let query = client.from('service_tasks').select('*').eq('organization_id', organizationId);
  if (serviceId) {
    query = query.eq('service_id', serviceId);
  }
  const { data, error } = await query;
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: (data ?? []).map(toServiceTask) };
}

export async function saveServiceTask(
  client: SupabaseServiceTasksClient,
  organizationId: string,
  serviceId: string,
  name: string
): Promise<CalculationResult<ServiceTask>> {
  const { data, error } = await client
    .from('service_tasks')
    .insert({ organization_id: organizationId, service_id: serviceId, name })
    .select('*')
    .single();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toServiceTask(data) };
}

export async function updateServiceTask(
  client: SupabaseServiceTasksClient,
  taskId: string,
  patch: {
    estimatedMinutes?: number | null;
    rate?: number | null;
    category?: string | null;
    active?: boolean;
    priceCents?: number | null;
    details?: string | null;
    materials?: string | null;
  }
): Promise<CalculationResult<ServiceTask>> {
  const updateObj: Record<string, unknown> = {};
  if ('estimatedMinutes' in patch) {
    updateObj.estimated_minutes = patch.estimatedMinutes;
  }
  if ('rate' in patch) {
    updateObj.rate = patch.rate;
  }
  if ('category' in patch) {
    updateObj.category = patch.category;
  }
  if ('active' in patch) {
    updateObj.active = patch.active;
  }
  if ('priceCents' in patch) {
    updateObj.price_cents = patch.priceCents;
  }
  if ('details' in patch) {
    updateObj.details = patch.details;
  }
  if ('materials' in patch) {
    updateObj.materials = patch.materials;
  }
  const { data, error } = await client
    .from('service_tasks')
    .update(updateObj)
    .eq('id', taskId)
    .select('*')
    .single();
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: toServiceTask(data) };
}

/* ------------------------------------------------------------------ *
 * Job classification — Standard / Engineered / Unclassified
 * ------------------------------------------------------------------ */

/**
 * Vocabulary established by migration 0023's comment
 * (`app/supabase/0023_field_ops_segway_and_estimating.sql`, lines 194-197):
 * "Standard/Engineered/Unclassified classification itself is derived (not
 * persisted) at query time from price_sheet_rates."
 *
 * THAT COMMENT'S CLAIM IS NOT BACKED BY ANY SCHEMA: `price_sheet_rates`
 * carries no classification-relevant column, in its original definition
 * (0005_money.sql) or in any later migration that touches it (0022 adds a
 * sibling table, price_sheet_area_adjustments, not a column; 0024 adds
 * estimated_minutes, an unrelated time-tracking field). The only
 * classification-relevant schema anywhere is `jobs.house_age_years`
 * (nullable integer, added by 0023 itself) and the
 * `job_notes.kind = 're_estimate_flag'` flag it also added.
 *
 * There is therefore no concrete threshold or rule to extract from
 * existing data — everything below is a NEW, minimal placeholder (not a
 * port of pre-existing business logic), with a single named,
 * easily-adjustable threshold standing in for a business decision that
 * has not yet been made.
 */
export type JobClassification = 'standard' | 'engineered' | 'unclassified';

/**
 * PLACEHOLDER threshold — no concrete value exists anywhere in the
 * codebase, plan docs, or migration comments (confirmed by reading
 * 0005/0022/0023/0024 in full and searching plans-deliveries/). Set this
 * once product supplies a real age-based (or other-attribute-based) rule
 * for 'engineered'; until then it stays null and every classified job
 * resolves to 'standard'.
 */
export const ENGINEERED_HOUSE_AGE_THRESHOLD_YEARS: number | null = null;

/**
 * Computes a job's Standard/Engineered/Unclassified classification from
 * its `houseAgeYears` input (`jobs.house_age_years`, added by migration
 * 0023). Pure and synchronous — matches the "derived, not persisted, at
 * query time" intent from 0023's comment, even though that comment's
 * specific claim of deriving from `price_sheet_rates` has no schema to
 * back it (see the type-doc above).
 */
export function classifyJob(houseAgeYears: number | null): JobClassification {
  if (houseAgeYears === null) {
    return 'unclassified';
  }
  if (
    ENGINEERED_HOUSE_AGE_THRESHOLD_YEARS !== null &&
    houseAgeYears >= ENGINEERED_HOUSE_AGE_THRESHOLD_YEARS
  ) {
    return 'engineered';
  }
  return 'standard';
}
