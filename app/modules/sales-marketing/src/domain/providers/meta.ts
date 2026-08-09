/**
 * Meta (Facebook/Instagram Graph API) social provider (JobCore P6 plan §2/§3).
 *
 * Mirrors `modules/payment-review/src/domain/providers/stripe-link.ts`'s
 * concrete-object convention: a plain `SocialProvider` object, no class. The
 * actual Graph API call, token lookup, and `post_targets`/`campaign_log`
 * writes all live server-side in the `meta-publish` Edge Function
 * (app/supabase/functions/meta-publish/index.ts) — this file only invokes
 * it and returns its `PostResult` verbatim. No token, secret, or Graph API
 * URL is ever referenced here.
 *
 * The Supabase client surface is kept minimal (matching
 * `data/ports.ts`'s `SupabaseSelectClient` discipline) rather than importing
 * the full `@supabase/supabase-js` `SupabaseClient` type — just enough of
 * `functions.invoke` to call `meta-publish`. Client injection mirrors
 * `modules/payment-review/src/index.ts`'s `setSupabaseClient`/
 * `getSupabaseClient` seam: no live client is constructed here, and
 * `postDraft` fails closed (returns a `failed` result) when it is unset.
 */

import type { PostDraft, PostResult, SocialProvider } from './types';

/** Minimal Supabase client surface this provider depends on. */
export interface SupabaseFunctionsClient {
  functions: {
    invoke(
      functionName: string,
      options: { body: unknown },
    ): Promise<{ data: PostResult | null; error: { message: string } | null }>;
  };
}

let currentClient: SupabaseFunctionsClient | null = null;

/** Injection point for the host. The ONLY function that may write `currentClient`. */
export function setMetaPublishClient(client: SupabaseFunctionsClient | null): void {
  currentClient = client;
}

/**
 * Calls the `meta-publish` Edge Function with the draft's id and target
 * platform. The Edge Function re-derives everything else (asset paths,
 * caption, token) from `post_drafts`/`post_targets`/`social_provider_credentials`
 * server-side — the client sends only enough to identify the row, and is
 * never the writer of `post_targets`/`campaign_log` itself.
 */
export const MetaPublishProvider: SocialProvider = {
  id: 'meta-publish',
  displayName: 'Meta (Facebook/Instagram)',
  platforms: ['facebook', 'instagram'],
  capabilities: { directPublish: true, requiresIgBusiness: true },
  async postDraft(draft: PostDraft): Promise<PostResult> {
    if (currentClient === null) {
      return { status: 'failed', error: 'meta-publish client not configured' };
    }
    const { data, error } = await currentClient.functions.invoke('meta-publish', {
      body: { draftId: draft.id, platform: draft.targetPlatform },
    });
    if (error || data === null) {
      return { status: 'failed', error: error?.message ?? 'meta-publish invocation failed' };
    }
    return data;
  },
};
