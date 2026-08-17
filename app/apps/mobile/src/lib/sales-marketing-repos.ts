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
  };
}
