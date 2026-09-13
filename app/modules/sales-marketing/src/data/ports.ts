/**
 * Data seam for the sales-marketing module (P6).
 *
 * Interfaces only — NO implementation. This file declares the snake_case
 * wire shapes, the row→domain mappers, and the repository ports the module
 * depends on; the host application injects concrete implementations
 * (sqlite, Supabase fetch, fixtures, whatever) behind these interfaces.
 * No sqlite, no fetch, no fixtures, no React live here. Mirrors
 * `modules/field-tech/src/data/ports.ts`'s shape exactly.
 *
 * Row shapes mirror `app/supabase/0010_payment_review.sql` (reviews) and
 * `app/supabase/0012_marketing.sql` (everything else) field-for-field.
 *
 * Scope fence (P6 plan): this module's ports NEVER expose a query touching
 * `commissions`, `price_sheets`, or `payout_batches` — those remain
 * admin-finance's exclusive concern. Do not add one here.
 */

import type { PostStatus } from '../domain/providers/types';

/* ------------------------------------------------------------------ *
 * reviews (review library) — READ-ONLY here except sort_order reorder
 * ------------------------------------------------------------------ */

/**
 * Mirrors `reviews` (0010, plus `sort_order` added in 0012). `platform` is
 * `string` — untrusted wire data until `toReview` validates it. This module
 * only ever selects rows with `publish_ok = true` (enforced server-side by
 * `reviews_select_sales`, 0012) and only ever updates `sort_order`
 * (enforced server-side by `reviews_sales_sort_whitelist_trg`, 0012).
 */
export interface ReviewRow {
  id: string;
  organization_id: string;
  job_id: string;
  rating: number;
  body: string | null;
  author_display_name: string | null;
  platform: string;
  submitted_at: string;
  publish_ok: boolean;
  sort_order: number;
}

export type ReviewPlatform = 'internal' | 'google' | 'facebook' | 'other';

const REVIEW_PLATFORMS: readonly ReviewPlatform[] = ['internal', 'google', 'facebook', 'other'];

function isReviewPlatform(value: string): value is ReviewPlatform {
  return (REVIEW_PLATFORMS as readonly string[]).includes(value);
}

/** Domain shape of a review. */
export interface Review {
  id: string;
  organizationId: string;
  jobId: string;
  rating: number;
  body: string | null;
  authorDisplayName: string | null;
  platform: ReviewPlatform;
  submittedAt: string;
  publishOk: boolean;
  sortOrder: number;
}

/**
 * Map a `reviews` row to the domain `Review`.
 * Throws on an unrecognized `platform` rather than widening the union —
 * fail closed instead of letting an unknown platform slip past callers.
 */
export function toReview(row: ReviewRow): Review {
  if (!isReviewPlatform(row.platform)) {
    throw new Error(`Unknown review platform "${row.platform}" on review ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobId: row.job_id,
    rating: row.rating,
    body: row.body,
    authorDisplayName: row.author_display_name,
    platform: row.platform,
    submittedAt: row.submitted_at,
    publishOk: row.publish_ok,
    sortOrder: row.sort_order,
  };
}

/**
 * Filters for `ReviewLibraryRepository.list`. `serviceId` filters on the
 * review's job's `service_id`; `communityId` filters on the review's job's
 * `service_area_id` — neither column lives on `reviews` itself, so the
 * implementation joins through `jobs` to apply them. All fields optional
 * and combine with AND.
 */
export interface ReviewLibraryFilter {
  minRating?: number;
  serviceId?: string;
  communityId?: string;
}

/**
 * Read + reorder access to the published review library. `list` ALWAYS
 * scopes to `publish_ok = true` — there is no method on this interface
 * that can return an unpublished review, matching `reviews_select_sales`
 * (0012) which enforces the same filter server-side. `reorder` is the only
 * write: it may change `sort_order` only, matching
 * `reviews_sales_sort_whitelist_trg` (0012).
 */
export interface ReviewLibraryRepository {
  list(organizationId: string, filter?: ReviewLibraryFilter): Promise<Review[]>;
  reorder(reviewId: string, sortOrder: number): Promise<Review>;
}

/* ------------------------------------------------------------------ *
 * marketing_assets
 * ------------------------------------------------------------------ */

/**
 * Mirrors `marketing_assets` (0012). Exactly one of `job_photo_id` /
 * `review_id` is populated (the migration's XOR check), never both and
 * never neither — this row shape mirrors the nullable-both-columns wire
 * form as-is, matching `ChecklistItemRow`'s precedent in field-tech.
 */
export interface MarketingAssetRow {
  id: string;
  organization_id: string;
  job_photo_id: string | null;
  review_id: string | null;
  approved_for_public: boolean;
  created_at: string;
  created_by: string | null;
}

/** Domain shape of a marketing asset. */
export interface MarketingAsset {
  id: string;
  organizationId: string;
  jobPhotoId: string | null;
  reviewId: string | null;
  approvedForPublic: boolean;
  createdAt: string;
  createdBy: string | null;
}

export function toMarketingAsset(row: MarketingAssetRow): MarketingAsset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    jobPhotoId: row.job_photo_id,
    reviewId: row.review_id,
    approvedForPublic: row.approved_for_public,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Fields needed to insert one `marketing_assets` row — exactly one of `jobPhotoId`/`reviewId` must be set. */
export interface MarketingAssetDraft {
  jobPhotoId: string | null;
  reviewId: string | null;
}

/** Read + curate access to marketing assets. `approve` flips `approved_for_public`. */
export interface MarketingAssetRepository {
  list(organizationId: string): Promise<MarketingAsset[]>;
  create(organizationId: string, draft: MarketingAssetDraft): Promise<MarketingAsset>;
  approve(assetId: string, approvedForPublic: boolean): Promise<MarketingAsset>;
}

/* ------------------------------------------------------------------ *
 * post_drafts
 * ------------------------------------------------------------------ */

/**
 * Mirrors `post_drafts` (0012). `status` is `string` — untrusted wire data
 * until `toPostDraft` validates it. Reuses the `PostStatus` union already
 * declared by `domain/providers/types.ts` rather than restating it, since
 * that file is this module's own precedent, not a foreign import.
 */
export interface PostDraftRow {
  id: string;
  organization_id: string;
  status: string;
  pitch_angle: string | null;
  service_id: string | null;
  service_area_id: string | null;
  suggested_caption: string | null;
  caption: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  created_by: string | null;
}

const POST_DRAFT_STATUSES: readonly PostStatus[] = ['draft', 'approved', 'posted', 'failed'];

function isPostStatus(value: string): value is PostStatus {
  return (POST_DRAFT_STATUSES as readonly string[]).includes(value);
}

/** Domain shape of a post draft. */
export interface PostDraft {
  id: string;
  organizationId: string;
  status: PostStatus;
  pitchAngle: string | null;
  serviceId: string | null;
  serviceAreaId: string | null;
  suggestedCaption: string | null;
  caption: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

/**
 * Map a `post_drafts` row to the domain `PostDraft`.
 * Throws on an unrecognized `status` rather than widening the union — fail
 * closed instead of letting an unknown status slip past approve/post gating.
 */
export function toPostDraft(row: PostDraftRow): PostDraft {
  if (!isPostStatus(row.status)) {
    throw new Error(`Unknown post draft status "${row.status}" on draft ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: row.status,
    pitchAngle: row.pitch_angle,
    serviceId: row.service_id,
    serviceAreaId: row.service_area_id,
    suggestedCaption: row.suggested_caption,
    caption: row.caption,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Fields needed to insert one `post_drafts` row. `status` always starts `'draft'`. */
export interface PostDraftDraft {
  pitchAngle: string | null;
  serviceId: string | null;
  serviceAreaId: string | null;
  suggestedCaption: string | null;
  caption: string | null;
}

/** Read + compose + approve access to post drafts. */
export interface PostDraftRepository {
  list(organizationId: string): Promise<PostDraft[]>;
  getById(draftId: string): Promise<PostDraft | null>;
  create(organizationId: string, draft: PostDraftDraft): Promise<PostDraft>;
  updateCaption(draftId: string, caption: string): Promise<PostDraft>;
  approve(draftId: string, approvedBy: string, approvedAt: string): Promise<PostDraft>;
}

/* ------------------------------------------------------------------ *
 * post_draft_assets
 * ------------------------------------------------------------------ */

/** Mirrors `post_draft_assets` (0012). */
export interface PostDraftAssetRow {
  id: string;
  organization_id: string;
  draft_id: string;
  asset_id: string;
  created_at: string;
}

/** Domain shape of a post draft's asset attachment. */
export interface PostDraftAsset {
  id: string;
  organizationId: string;
  draftId: string;
  assetId: string;
  createdAt: string;
}

export function toPostDraftAsset(row: PostDraftAssetRow): PostDraftAsset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    draftId: row.draft_id,
    assetId: row.asset_id,
    createdAt: row.created_at,
  };
}

/**
 * Read + attach access to a draft's assets. `attach` may fail server-side
 * if the referenced asset is not `approved_for_public` and dual-consented
 * (`post_draft_assets_consent_check_trg`, 0012) — this port does not
 * pre-validate that itself, it only surfaces whatever the DB rejects.
 */
export interface PostDraftAssetRepository {
  listForDraft(draftId: string): Promise<PostDraftAsset[]>;
  attach(organizationId: string, draftId: string, assetId: string): Promise<PostDraftAsset>;
  detach(postDraftAssetId: string): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * post_targets
 * ------------------------------------------------------------------ */

/**
 * The full post-target status union, restated as a runtime tuple so
 * `toPostTarget` can validate an untrusted row's `status` string against
 * it. Mirrors `post_targets_status_check` in the migration.
 */
export type PostTargetStatus = 'pending' | 'posted' | 'failed';

const POST_TARGET_STATUSES: readonly PostTargetStatus[] = ['pending', 'posted', 'failed'];

function isPostTargetStatus(value: string): value is PostTargetStatus {
  return (POST_TARGET_STATUSES as readonly string[]).includes(value);
}

/**
 * Mirrors `post_targets` (0012). `platform` is deliberately plain `string`
 * on both row and domain shape — it is unconstrained text in the DB (AC-8:
 * adding a `SocialProvider` never requires a schema change here).
 */
export interface PostTargetRow {
  id: string;
  organization_id: string;
  draft_id: string;
  platform: string;
  status: string;
  posted_platform_id: string | null;
  error: string | null;
  created_at: string;
}

/** Domain shape of a post target. */
export interface PostTarget {
  id: string;
  organizationId: string;
  draftId: string;
  platform: string;
  status: PostTargetStatus;
  postedPlatformId: string | null;
  error: string | null;
  createdAt: string;
}

/**
 * Map a `post_targets` row to the domain `PostTarget`.
 * Throws on an unrecognized `status` rather than widening the union — fail
 * closed instead of letting an unknown status slip past posting logic.
 */
export function toPostTarget(row: PostTargetRow): PostTarget {
  if (!isPostTargetStatus(row.status)) {
    throw new Error(`Unknown post target status "${row.status}" on target ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    draftId: row.draft_id,
    platform: row.platform,
    status: row.status,
    postedPlatformId: row.posted_platform_id,
    error: row.error,
    createdAt: row.created_at,
  };
}

/** Fields needed to insert one `post_targets` row. `status` always starts `'pending'`. */
export interface PostTargetDraft {
  draftId: string;
  platform: string;
}

/** Read + create access to a draft's per-platform targets. Status transitions (`posted`/`failed`) are the meta-publish Edge Function's concern, not exposed here. */
export interface PostTargetRepository {
  listForDraft(draftId: string): Promise<PostTarget[]>;
  create(organizationId: string, draft: PostTargetDraft): Promise<PostTarget>;
}

/* ------------------------------------------------------------------ *
 * campaign_log — append-only
 * ------------------------------------------------------------------ */

/**
 * The full campaign log channel union, restated as a runtime tuple so
 * `toCampaignLogEntry` can validate an untrusted row's `channel` string
 * against it. Mirrors `campaign_log_channel_check` in the migration.
 */
export type CampaignLogChannel = 'manual' | 'api';

const CAMPAIGN_LOG_CHANNELS: readonly CampaignLogChannel[] = ['manual', 'api'];

function isCampaignLogChannel(value: string): value is CampaignLogChannel {
  return (CAMPAIGN_LOG_CHANNELS as readonly string[]).includes(value);
}

/**
 * Mirrors `campaign_log` (0012). Bigint identity pk mirrors `audit_log`'s
 * shape — `id` is `string` here to carry it safely across the JS/JSON
 * boundary without precision loss, matching this codebase's convention for
 * bigint ids elsewhere.
 */
export interface CampaignLogRow {
  id: string;
  organization_id: string;
  draft_id: string | null;
  channel: string;
  platform: string | null;
  status: string;
  actor_id: string | null;
  occurred_at: string;
}

/** Domain shape of a campaign log entry. */
export interface CampaignLogEntry {
  id: string;
  organizationId: string;
  draftId: string | null;
  channel: CampaignLogChannel;
  platform: string | null;
  status: string;
  actorId: string | null;
  occurredAt: string;
}

/**
 * Map a `campaign_log` row to the domain `CampaignLogEntry`.
 * Throws on an unrecognized `channel` rather than widening the union — fail
 * closed instead of letting an unknown channel slip past reporting logic.
 */
export function toCampaignLogEntry(row: CampaignLogRow): CampaignLogEntry {
  if (!isCampaignLogChannel(row.channel)) {
    throw new Error(`Unknown campaign log channel "${row.channel}" on entry ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    draftId: row.draft_id,
    channel: row.channel,
    platform: row.platform,
    status: row.status,
    actorId: row.actor_id,
    occurredAt: row.occurred_at,
  };
}

/** Fields needed to insert one `campaign_log` row (id/occurred_at are implementation-assigned). */
export interface CampaignLogEntryDraft {
  draftId: string | null;
  channel: CampaignLogChannel;
  platform: string | null;
  status: string;
  actorId: string | null;
}

/**
 * Read + insert access to the campaign log. Insert-only write — no
 * update/delete method, matching the table's own append-only RLS shape
 * (no update/delete policy exists for any role, 0012).
 */
export interface CampaignLogRepository {
  listForOrganization(organizationId: string): Promise<CampaignLogEntry[]>;
  create(organizationId: string, draft: CampaignLogEntryDraft): Promise<CampaignLogEntry>;
}

/* ------------------------------------------------------------------ *
 * social_providers
 * ------------------------------------------------------------------ */

/**
 * Mirrors `social_providers` (0012). Deliberately excludes
 * `social_provider_credentials` entirely — that table has zero
 * authenticated-role RLS policies (0012 § 6) and is reachable only by the
 * meta-publish Edge Function's service-role key, never by this module.
 */
export interface SocialProviderRow {
  id: string;
  organization_id: string;
  provider_id: string;
  platform: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Domain shape of a social provider's org-level config. */
export interface SocialProviderConfig {
  id: string;
  organizationId: string;
  providerId: string;
  platform: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function toSocialProviderConfig(row: SocialProviderRow): SocialProviderConfig {
  return {
    id: row.id,
    organizationId: row.organization_id,
    providerId: row.provider_id,
    platform: row.platform,
    enabled: row.enabled,
    config: row.config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Read-only access to social provider enablement for this module.
 * Enablement is admin-owned (`social_providers_admin_all`, 0012); the
 * composer only ever needs to read `enabled` to decide whether to offer the
 * API path (AC-4) — no write method is exposed here.
 */
export interface SocialProviderRepository {
  listForOrganization(organizationId: string): Promise<SocialProviderConfig[]>;
  getByProviderId(organizationId: string, providerId: string): Promise<SocialProviderConfig | null>;
}

/* ------------------------------------------------------------------ *
 * test jobs (Workstream K: "Spawn Test Jobs") — writes `jobs` directly
 * ------------------------------------------------------------------ */

/** A single spawned test job, as listed for the Sales & Marketing test-job panel. */
export type TestJobRow = {
  id: string;
  description: string | null;
  address: string | null;
  status: string;
  createdAt: string;
};

/**
 * Workstream K. Touches the core `jobs` table (`is_beta`,
 * `app/supabase/0018_beta_test_jobs.sql`) rather than any table this module
 * otherwise owns — an intentional, narrow exception to this file's usual
 * reviews/marketing/post scope, kept here only because "Spawn Test Jobs"
 * lives in this module's UI. No RLS change, no synthetic payment/commission
 * rows — see the migration and the scope-fence note above.
 *
 * `spawnTestJobs` MUST be reset-then-insert and idempotent: delete any
 * existing `is_beta = true` rows for the org first, then insert exactly 3
 * new `jobs` rows (`status = 'new'`, `is_beta = true`) using a real Carlsbad
 * service area + address and customer "Test Customer" / 760-580-6041.
 * `assigned_tech_id` is left null (omitted) so the jobs stay assignable to
 * any active tech rather than pre-assigned. Repeated calls must leave
 * exactly 3 beta rows, never accumulate.
 *
 * `listTestJobs`, `deleteTestJob`, and `deleteAllTestJobs` round out the
 * lifecycle so spawned jobs can be inspected and cleared from the UI at any
 * time, individually or all at once — normal (non-`is_beta`) jobs are never
 * deletable through this or any other port.
 */
export interface TestJobsRepository {
  /**
   * Deletes any existing test jobs for this organization, then creates 3
   * fresh ones: Carlsbad service area, a real Carlsbad address, customer
   * "Test Customer" / 760-580-6041, and no tech assigned (left
   * assignable). Marked via `is_beta = true` so they can be listed and
   * deleted independently of real jobs, which are never deletable.
   */
  spawnTestJobs(organizationId: string): Promise<void>;
  /** Lists current test jobs (is_beta = true) for this organization. */
  listTestJobs(organizationId: string): Promise<TestJobRow[]>;
  /** Deletes a single test job by id; refuses jobs not marked is_beta. */
  deleteTestJob(jobId: string): Promise<void>;
  /** Deletes all is_beta test jobs for this organization at once. */
  deleteAllTestJobs(organizationId: string): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * sales callback tasks (Workstream J) — queries `jobs`+`customers`
 * joined against the new `sales_callback_status` table
 * ------------------------------------------------------------------ */

/**
 * Mirrors the composed row an open-callback-task query returns: `jobs`
 * (`app/supabase/0004_scheduling.sql`) filtered to `status = 'completed'`,
 * left-joined to `customers` for contact info and to the new
 * `sales_callback_status` (`app/supabase/0017_sales_callback_status.sql`)
 * for done/not-done state. Not a single-table row like this file's other
 * `XxxRow` shapes — `jobs` is not otherwise queried by this module (it is
 * not on the scope-fence list above; `commissions`/`price_sheets`/
 * `payout_batches` remain off limits). `called_back_at`/`called_back_by`
 * are `null` both when no `sales_callback_status` row exists yet and when
 * one exists but hasn't been marked done — the implementation's LEFT JOIN
 * makes both cases collapse to the same absent-value shape, matching this
 * port's "open task" definition below.
 */
export interface CallbackTaskRow {
  job_id: string;
  organization_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  completed_at: string | null;
  is_beta: boolean;
  called_back_at: string | null;
  called_back_by: string | null;
}

/** Domain shape of one sales callback task. */
export interface CallbackTask {
  jobId: string;
  organizationId: string;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  completedAt: string | null;
  isBeta: boolean;
  calledBackAt: string | null;
  calledBackBy: string | null;
}

export function toCallbackTask(row: CallbackTaskRow): CallbackTask {
  return {
    jobId: row.job_id,
    organizationId: row.organization_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    address: row.address,
    completedAt: row.completed_at,
    isBeta: row.is_beta,
    calledBackAt: row.called_back_at,
    calledBackBy: row.called_back_by,
  };
}

/**
 * Read + mark-done access to open sales callback tasks. `listOpen` returns
 * only completed jobs where `called_back_at is null` (no row, or a row with
 * a null timestamp) — the "open task" definition from the plan (Workstream
 * J). `markCalledBack` upserts the `sales_callback_status` row, setting
 * `called_back_at`/`called_back_by`; this is the only write this port
 * exposes.
 */
export interface CallbackTaskRepository {
  listOpen(organizationId: string): Promise<CallbackTask[]>;
  markCalledBack(jobId: string, organizationId: string, calledBackBy: string, calledBackAt: string): Promise<CallbackTask>;
}
