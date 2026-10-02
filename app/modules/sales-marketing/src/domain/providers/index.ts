/**
 * Social provider registry/barrel (JobCore P6 plan §2) — the gap P5 left
 * unfilled for `PaymentProvider`. The Composer and Reporting screens resolve
 * a provider only through `getProvider`/`listProviders`, never via a direct
 * import of `./meta` — that indirection, plus the unconstrained-`text`
 * `post_targets.platform` column (app/supabase/migrations/0012_marketing.sql), is what
 * makes AC-8 true: adding a second `SocialProvider` (e.g. LinkedIn) is a new
 * `linkedin.ts` file registered below, no Composer change required.
 */

import type { SocialProvider } from './types';
import { MetaPublishProvider } from './meta';

const PROVIDERS: readonly SocialProvider[] = [MetaPublishProvider];

/** Looks up a registered provider by id (e.g. `'meta-publish'`). `undefined` if not registered. */
export function getProvider(id: string): SocialProvider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

/** All registered providers, in registration order. */
export function listProviders(): readonly SocialProvider[] {
  return PROVIDERS;
}

export type { PostDraft, PostResult, PostStatus, SocialProvider } from './types';
export { MetaPublishProvider, setMetaPublishClient } from './meta';
