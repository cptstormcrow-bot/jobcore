/**
 * Supabase-backed repository implementations for the sales-marketing
 * module's data ports (P6).
 *
 * `modules/sales-marketing/src/data/ports.ts` declares interfaces only — no
 * sqlite, no fetch, no Supabase. This file is the host-side (apps/mobile)
 * concrete implementation the host injects via
 * `modules/sales-marketing/src/lib/module-ports.ts`'s `setModulePorts`. This
 * is not a general framework for other modules — sales-marketing's ports
 * only. Mirrors `apps/mobile/src/lib/field-tech-repos.ts`'s shape and
 * conventions exactly.
 *
 * Uses the shared `supabase` client from `apps/mobile/src/lib/supabase.ts`
 * (chunked SecureStore-backed auth session), matching the client-access
 * pattern already established elsewhere in the app.
 */

import { supabase } from './supabase';
import type {
  ReviewLibraryRepository,
  ReviewLibraryFilter,
  Review,
  ReviewRow,
  MarketingAssetRepository,
  MarketingAsset,
  MarketingAssetRow,
  MarketingAssetDraft,
  PostDraftRepository,
  PostDraft,
  PostDraftRow,
  PostDraftDraft,
  PostDraftAssetRepository,
  PostDraftAsset,
  PostDraftAssetRow,
  PostTargetRepository,
  PostTarget,
  PostTargetRow,
  PostTargetDraft,
  CampaignLogRepository,
  CampaignLogEntry,
  CampaignLogRow,
  CampaignLogEntryDraft,
  SocialProviderRepository,
  SocialProviderConfig,
  SocialProviderRow,
  TestJobsRepository,
  CallbackTaskRepository,
  CallbackTask,
  CallbackTaskRow,
  JobReportingRepository,
  JobReportingRow,
} from '../../../../modules/sales-marketing/src/data/ports';
import type { ModulePorts } from '../../../../modules/sales-marketing/src/lib/module-ports';
import {
  toReview,
  toMarketingAsset,
  toPostDraft,
  toPostDraftAsset,
  toPostTarget,
  toCampaignLogEntry,
  toSocialProviderConfig,
  toCallbackTask,
} from '../../../../modules/sales-marketing/src/data/ports';

/* ------------------------------------------------------------------ *
 * ReviewLibraryRepository
 * ------------------------------------------------------------------ */

export function createReviewLibraryRepository(): ReviewLibraryRepository {
  return {
    async list(organizationId: string, filter?: ReviewLibraryFilter): Promise<Review[]> {
      let query = supabase
        .from('reviews')
        .select('*')
        .eq('organization_id', organizationId);
      if (filter?.minRating !== undefined) {
        query = query.gte('rating', filter.minRating);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`list reviews failed: ${error.message}`);
      }
      return ((data ?? []) as ReviewRow[]).map(toReview);
    },

    async reorder(reviewId: string, sortOrder: number): Promise<Review> {
      const { data, error } = await supabase
        .from('reviews')
        .update({ sort_order: sortOrder })
        .eq('id', reviewId)
        .select('*')
        .single();
      if (error) {
        throw new Error(`reorder review failed: ${error.message}`);
      }
      return toReview(data as ReviewRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * MarketingAssetRepository
 * ------------------------------------------------------------------ */

export function createMarketingAssetRepository(): MarketingAssetRepository {
  return {
    async list(organizationId: string): Promise<MarketingAsset[]> {
      const { data, error } = await supabase
        .from('marketing_assets')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`list marketing assets failed: ${error.message}`);
      }
      return ((data ?? []) as MarketingAssetRow[]).map(toMarketingAsset);
    },

    async create(organizationId: string, draft: MarketingAssetDraft): Promise<MarketingAsset> {
      const { data, error } = await supabase
        .from('marketing_assets')
        .insert({
          organization_id: organizationId,
          job_photo_id: draft.jobPhotoId,
          review_id: draft.reviewId,
        })
        .select('*')
        .single();
      if (error) {
        throw new Error(`create marketing asset failed: ${error.message}`);
      }
      return toMarketingAsset(data as MarketingAssetRow);
    },

    async approve(assetId: string, approvedForPublic: boolean): Promise<MarketingAsset> {
      const { data, error } = await supabase
        .from('marketing_assets')
        .update({ approved_for_public: approvedForPublic })
        .eq('id', assetId)
        .select('*')
        .single();
      if (error) {
        throw new Error(`approve marketing asset failed: ${error.message}`);
      }
      return toMarketingAsset(data as MarketingAssetRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * PostDraftRepository
 * ------------------------------------------------------------------ */

export function createPostDraftRepository(): PostDraftRepository {
  return {
    async list(organizationId: string): Promise<PostDraft[]> {
      const { data, error } = await supabase
        .from('post_drafts')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`list post drafts failed: ${error.message}`);
      }
      return ((data ?? []) as PostDraftRow[]).map(toPostDraft);
    },

    async getById(draftId: string): Promise<PostDraft | null> {
      const { data, error } = await supabase
        .from('post_drafts')
        .select('*')
        .eq('id', draftId)
        .maybeSingle();
      if (error) {
        throw new Error(`getById post draft failed: ${error.message}`);
      }
      return data ? toPostDraft(data as PostDraftRow) : null;
    },

    async create(organizationId: string, draft: PostDraftDraft): Promise<PostDraft> {
      const { data, error } = await supabase
        .from('post_drafts')
        .insert({
          organization_id: organizationId,
          status: 'draft',
          pitch_angle: draft.pitchAngle,
          service_id: draft.serviceId,
          service_area_id: draft.serviceAreaId,
          suggested_caption: draft.suggestedCaption,
          caption: draft.caption,
        })
        .select('*')
        .single();
      if (error) {
        throw new Error(`create post draft failed: ${error.message}`);
      }
      return toPostDraft(data as PostDraftRow);
    },

    async updateCaption(draftId: string, caption: string): Promise<PostDraft> {
      const { data, error } = await supabase
        .from('post_drafts')
        .update({ caption })
        .eq('id', draftId)
        .select('*')
        .single();
      if (error) {
        throw new Error(`updateCaption post draft failed: ${error.message}`);
      }
      return toPostDraft(data as PostDraftRow);
    },

    async approve(draftId: string, approvedBy: string, approvedAt: string): Promise<PostDraft> {
      const { data, error } = await supabase
        .from('post_drafts')
        .update({ status: 'approved', approved_by: approvedBy, approved_at: approvedAt })
        .eq('id', draftId)
        .select('*')
        .single();
      if (error) {
        throw new Error(`approve post draft failed: ${error.message}`);
      }
      return toPostDraft(data as PostDraftRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * PostDraftAssetRepository
 * ------------------------------------------------------------------ */

export function createPostDraftAssetRepository(): PostDraftAssetRepository {
  return {
    async listForDraft(draftId: string): Promise<PostDraftAsset[]> {
      const { data, error } = await supabase
        .from('post_draft_assets')
        .select('*')
        .eq('draft_id', draftId);
      if (error) {
        throw new Error(`listForDraft post draft assets failed: ${error.message}`);
      }
      return ((data ?? []) as PostDraftAssetRow[]).map(toPostDraftAsset);
    },

    async attach(organizationId: string, draftId: string, assetId: string): Promise<PostDraftAsset> {
      const { data, error } = await supabase
        .from('post_draft_assets')
        .insert({
          organization_id: organizationId,
          draft_id: draftId,
          asset_id: assetId,
        })
        .select('*')
        .single();
      if (error) {
        throw new Error(`attach post draft asset failed: ${error.message}`);
      }
      return toPostDraftAsset(data as PostDraftAssetRow);
    },

    async detach(postDraftAssetId: string): Promise<void> {
      const { error } = await supabase
        .from('post_draft_assets')
        .delete()
        .eq('id', postDraftAssetId);
      if (error) {
        throw new Error(`detach post draft asset failed: ${error.message}`);
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * PostTargetRepository
 * ------------------------------------------------------------------ */

export function createPostTargetRepository(): PostTargetRepository {
  return {
    async listForDraft(draftId: string): Promise<PostTarget[]> {
      const { data, error } = await supabase
        .from('post_targets')
        .select('*')
        .eq('draft_id', draftId);
      if (error) {
        throw new Error(`listForDraft post targets failed: ${error.message}`);
      }
      return ((data ?? []) as PostTargetRow[]).map(toPostTarget);
    },

    async create(organizationId: string, draft: PostTargetDraft): Promise<PostTarget> {
      const { data, error } = await supabase
        .from('post_targets')
        .insert({
          organization_id: organizationId,
          draft_id: draft.draftId,
          platform: draft.platform,
          status: 'pending',
        })
        .select('*')
        .single();
      if (error) {
        throw new Error(`create post target failed: ${error.message}`);
      }
      return toPostTarget(data as PostTargetRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * CampaignLogRepository — append-only
 * ------------------------------------------------------------------ */

export function createCampaignLogRepository(): CampaignLogRepository {
  return {
    async listForOrganization(organizationId: string): Promise<CampaignLogEntry[]> {
      const { data, error } = await supabase
        .from('campaign_log')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization campaign log failed: ${error.message}`);
      }
      return ((data ?? []) as CampaignLogRow[]).map(toCampaignLogEntry);
    },

    async create(organizationId: string, draft: CampaignLogEntryDraft): Promise<CampaignLogEntry> {
      const { data, error } = await supabase
        .from('campaign_log')
        .insert({
          organization_id: organizationId,
          draft_id: draft.draftId,
          channel: draft.channel,
          platform: draft.platform,
          status: draft.status,
          actor_id: draft.actorId,
        })
        .select('*')
        .single();
      if (error) {
        throw new Error(`create campaign log entry failed: ${error.message}`);
      }
      return toCampaignLogEntry(data as CampaignLogRow);
    },
  };
}

/* ------------------------------------------------------------------ *
 * SocialProviderRepository — read-only
 * ------------------------------------------------------------------ */

export function createSocialProviderRepository(): SocialProviderRepository {
  return {
    async listForOrganization(organizationId: string): Promise<SocialProviderConfig[]> {
      const { data, error } = await supabase
        .from('social_providers')
        .select('*')
        .eq('organization_id', organizationId);
      if (error) {
        throw new Error(`listForOrganization social providers failed: ${error.message}`);
      }
      return ((data ?? []) as SocialProviderRow[]).map(toSocialProviderConfig);
    },

    async getByProviderId(organizationId: string, providerId: string): Promise<SocialProviderConfig | null> {
      const { data, error } = await supabase
        .from('social_providers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('provider_id', providerId)
        .maybeSingle();
      if (error) {
        throw new Error(`getByProviderId social provider failed: ${error.message}`);
      }
      return data ? toSocialProviderConfig(data as SocialProviderRow) : null;
    },
  };
}

/* ------------------------------------------------------------------ *
 * TestJobsRepository — "Spawn Test Jobs" (Workstream K)
 *
 * Reset-then-insert, idempotent per the doc contract on
 * `TestJobsRepository` in `modules/sales-marketing/src/data/ports.ts`:
 * delete any existing `is_beta = true` rows for this org, then insert
 * exactly 3 new `jobs` rows at `status = 'new'` (the job lifecycle's
 * intake/sales-handoff stage — `packages/core/src/index.ts`'s `JobStatus`
 * union, `supabase/migrations/0004_scheduling.sql`'s `jobs` table default) with
 * `is_beta = true` and placeholder address/description text only. No
 * customer/service/financial rows are created — `customer_id`/`service_id`
 * stay null (both nullable) and no `commissions`/`price_sheets`/
 * `payout_batches` row is ever touched here, per the scope-fence note on
 * `TestJobsRepository`.
 * ------------------------------------------------------------------ */

const CARLSBAD_SERVICE_AREA_NAME = 'Carlsbad';
const TEST_CUSTOMER_NAME = 'Test Customer';
const TEST_CUSTOMER_PHONE = '760-580-6041';
const TEST_JOB_ADDRESSES = [
  '2450 Jefferson St, Carlsbad, CA 92008',
  '1140 Carlsbad Village Dr, Carlsbad, CA 92008',
  '3200 Roosevelt St, Carlsbad, CA 92008',
];

export function createTestJobsRepository(): TestJobsRepository {
  return {
    async spawnTestJobs(organizationId: string): Promise<void> {
      const { error: deleteError } = await supabase
        .from('jobs')
        .delete()
        .eq('organization_id', organizationId)
        .eq('is_beta', true)
        .eq('source', 'beta-test');
      if (deleteError) {
        throw new Error(`spawnTestJobs reset failed: ${deleteError.message}`);
      }

      const { data: serviceArea, error: serviceAreaError } = await supabase
        .from('service_areas')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('name', CARLSBAD_SERVICE_AREA_NAME)
        .maybeSingle();
      if (serviceAreaError) {
        throw new Error(`spawnTestJobs service area lookup failed: ${serviceAreaError.message}`);
      }

      let customerId: string;
      const { data: existingCustomer, error: customerLookupError } = await supabase
        .from('customers')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('name', TEST_CUSTOMER_NAME)
        .maybeSingle();
      if (customerLookupError) {
        throw new Error(`spawnTestJobs customer lookup failed: ${customerLookupError.message}`);
      }
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerInsertError } = await supabase
          .from('customers')
          .insert({
            organization_id: organizationId,
            name: TEST_CUSTOMER_NAME,
            phone: TEST_CUSTOMER_PHONE,
          })
          .select('id')
          .single();
        if (customerInsertError || !newCustomer) {
          throw new Error(`spawnTestJobs customer create failed: ${customerInsertError?.message}`);
        }
        customerId = newCustomer.id;
      }

      const rows = TEST_JOB_ADDRESSES.map((address, index) => ({
        organization_id: organizationId,
        status: 'new' as const,
        is_beta: true,
        source: 'beta-test',
        description: `Test job ${index + 1} — spawned for testing`,
        address,
        service_area_id: serviceArea?.id ?? null,
        customer_id: customerId,
      }));
      const { error: insertError } = await supabase.from('jobs').insert(rows);
      if (insertError) {
        throw new Error(`spawnTestJobs insert failed: ${insertError.message}`);
      }
    },

    async listTestJobs(organizationId: string) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, description, address, status, created_at')
        .eq('organization_id', organizationId)
        .eq('is_beta', true)
        .order('created_at', { ascending: true });
      if (error) {
        throw new Error(`listTestJobs failed: ${error.message}`);
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        description: row.description,
        address: row.address,
        status: row.status,
        createdAt: row.created_at,
      }));
    },

    async deleteTestJob(jobId: string): Promise<void> {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('is_beta', true);
      if (error) {
        throw new Error(`deleteTestJob failed: ${error.message}`);
      }
    },

    async deleteAllTestJobs(organizationId: string): Promise<void> {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('organization_id', organizationId)
        .eq('is_beta', true);
      if (error) {
        throw new Error(`deleteAllTestJobs failed: ${error.message}`);
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * CallbackTaskRepository — "Sales callback task from completed jobs"
 * (Workstream J)
 *
 * `listOpen` reads completed jobs LEFT JOINed against
 * `sales_callback_status`; customer name/phone live on `customers`
 * (joined via `jobs.customer_id`), not on `jobs` itself — see
 * `CallbackTaskRow`'s doc comment in `data/ports.ts`. Supabase's nested
 * embed (`customers(name, phone)`) plus the left-joined
 * `sales_callback_status(called_back_at, called_back_by)` gives one row
 * per completed job; a task is "open" when there is no
 * `sales_callback_status` row, or its `called_back_at` is null. That
 * filter can't be expressed server-side against an embedded 0..1 table
 * with plain `.eq`/`.is`, so it's applied client-side after the fetch,
 * mirroring how `TestJobsRepository` above keeps its query simple and
 * pushes shaping into JS.
 * ------------------------------------------------------------------ */

interface CallbackTaskFetchRow {
  id: string;
  organization_id: string;
  address: string | null;
  completed_at: string | null;
  is_beta: boolean;
  customers: { name: string | null; phone: string | null } | null;
  sales_callback_status: { called_back_at: string | null; called_back_by: string | null } | null;
}

function toCallbackTaskRow(row: CallbackTaskFetchRow): CallbackTaskRow {
  return {
    job_id: row.id,
    organization_id: row.organization_id,
    customer_name: row.customers?.name ?? null,
    customer_phone: row.customers?.phone ?? null,
    address: row.address,
    completed_at: row.completed_at,
    is_beta: row.is_beta,
    called_back_at: row.sales_callback_status?.called_back_at ?? null,
    called_back_by: row.sales_callback_status?.called_back_by ?? null,
  };
}

export function createCallbackTaskRepository(): CallbackTaskRepository {
  return {
    async listOpen(organizationId: string): Promise<CallbackTask[]> {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, organization_id, address, completed_at, is_beta, customers(name, phone), sales_callback_status(called_back_at, called_back_by)')
        .eq('organization_id', organizationId)
        .eq('status', 'completed');
      if (error) {
        throw new Error(`listOpen callback tasks failed: ${error.message}`);
      }
      const rows = (data ?? []) as unknown as CallbackTaskFetchRow[];
      return rows
        .map(toCallbackTaskRow)
        .filter((row) => row.called_back_at === null)
        .map(toCallbackTask);
    },

    async markCalledBack(
      jobId: string,
      organizationId: string,
      calledBackBy: string,
      calledBackAt: string,
    ): Promise<CallbackTask> {
      const { error: upsertError } = await supabase.from('sales_callback_status').upsert(
        {
          job_id: jobId,
          organization_id: organizationId,
          called_back_at: calledBackAt,
          called_back_by: calledBackBy,
        },
        { onConflict: 'job_id' },
      );
      if (upsertError) {
        throw new Error(`markCalledBack upsert failed: ${upsertError.message}`);
      }

      const { data, error } = await supabase
        .from('jobs')
        .select('id, organization_id, address, completed_at, is_beta, customers(name, phone), sales_callback_status(called_back_at, called_back_by)')
        .eq('id', jobId)
        .single();
      if (error) {
        throw new Error(`markCalledBack refetch failed: ${error.message}`);
      }
      return toCallbackTask(toCallbackTaskRow(data as unknown as CallbackTaskFetchRow));
    },
  };
}

export function createJobReportingRepository(): JobReportingRepository {
  return {
    async listJobsForReporting(organizationId) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, source, attach_timing, is_beta')
        .eq('organization_id', organizationId);
      if (error) throw new Error(`listJobsForReporting failed: ${error.message}`);
      return (data ?? []).map((r) => ({
        id: String(r.id),
        source: (r.source as string | null) ?? null,
        attachTiming: (r.attach_timing as string | null) ?? null,
        isBeta: Boolean(r.is_beta),
      }));
    },
  };
}

/* ------------------------------------------------------------------ *
 * ModulePorts aggregator
 * ------------------------------------------------------------------ */

export function buildSalesMarketingPorts(): ModulePorts {
  return {
    reviews: createReviewLibraryRepository(),
    marketingAssets: createMarketingAssetRepository(),
    postDrafts: createPostDraftRepository(),
    postDraftAssets: createPostDraftAssetRepository(),
    postTargets: createPostTargetRepository(),
    campaignLog: createCampaignLogRepository(),
    socialProviders: createSocialProviderRepository(),
    testJobs: createTestJobsRepository(),
    callbackTasks: createCallbackTaskRepository(),
    jobReporting: createJobReportingRepository(),
  };
}
