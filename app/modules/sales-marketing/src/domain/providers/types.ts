/**
 * SocialProvider contract (JobCore P6 plan §2), mirroring P5's
 * `PaymentProvider` pattern (modules/payment-review/src/domain/providers/types.ts)
 * exactly, including the registry/barrel file P5 didn't have (./index.ts).
 *
 * `platform` is deliberately a plain string everywhere in this module, not
 * an enum — it mirrors the unconstrained `text` `post_targets.platform`
 * column (app/supabase/migrations/0012_marketing.sql) so that AC-8 ("adding a second
 * `SocialProvider` requires no change to the composer") never requires a
 * type change here either.
 */

/**
 * Mirrors the Postgres `post_drafts.status` check constraint
 * (app/supabase/migrations/0012_marketing.sql, `post_drafts_status_check`):
 * 'draft' | 'approved' | 'posted' | 'failed'.
 */
export type PostStatus = 'draft' | 'approved' | 'posted' | 'failed';

/**
 * A draft ready to be handed to a provider's `postDraft()`. `assetPaths`
 * are already-resolved URLs/URIs for the draft's approved marketing assets
 * (no fetching or consent logic lives here — that's enforced server-side by
 * the `post_draft_assets_consent_check_trg` trigger before a draft's assets
 * can even be assembled).
 */
export interface PostDraft {
  id: string;
  targetPlatform: string;
  caption: string;
  assetPaths: string[];
}

/**
 * The result of a `postDraft()` call. The Edge Function (`meta-publish`) is
 * the sole writer of the corresponding `post_targets` row and the
 * `campaign_log` insert this result implies — this type is what it returns
 * to the client, not what the client writes itself.
 */
export type PostResult =
  | { status: 'posted'; platformPostId: string; postedAt: string }
  | { status: 'failed'; error: string };

/**
 * A social/marketing provider integration a module (or org) may enable.
 * `platforms` lists the plain-string platform names this provider can post
 * to (e.g. `['facebook', 'instagram']`).
 */
export interface SocialProvider {
  id: string;
  displayName: string;
  platforms: string[];
  capabilities: { directPublish: boolean; requiresIgBusiness: boolean };
  postDraft(draft: PostDraft): Promise<PostResult>;
}
