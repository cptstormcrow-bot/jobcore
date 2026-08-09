/**
 * Per-platform composer guidance (JobCore P6 plan §5) — character limits and
 * aspect-ratio guidance the Composer surfaces while a draft's caption/assets
 * are edited. Keyed by plain platform strings, matching `post_targets.platform`
 * (an unconstrained `text` column, app/supabase/0012_marketing.sql) and
 * `SocialProvider.platforms` (./providers/types.ts) — deliberately not an
 * enum, so a new platform is a new map entry, not a type change (AC-8).
 *
 * Values are UI guidance only — nothing here is enforced server-side; the
 * Edge Function (meta-publish) does not reject an over-limit caption.
 */

export interface PlatformSpec {
  /** Recommended maximum caption length in characters. */
  captionCharLimit: number;
  /** Recommended image/video aspect ratio, as a human-readable label. */
  aspectRatio: string;
  /** Short guidance shown in the Composer alongside the limits above. */
  guidance: string;
}

export const PLATFORM_SPECS: Readonly<Record<string, PlatformSpec>> = {
  facebook: {
    captionCharLimit: 63206,
    aspectRatio: '1:1 (square) or 4:5 (portrait) recommended',
    guidance: 'Long captions are truncated in-feed; keep the lead sentence self-contained.',
  },
  instagram: {
    captionCharLimit: 2200,
    aspectRatio: '1:1 (square) or 4:5 (portrait) recommended',
    guidance: 'First ~125 characters show before "more" — front-load the pitch angle.',
  },
};

/** Guidance for an unlisted platform — used when a platform has no `PLATFORM_SPECS` entry yet. */
export const DEFAULT_PLATFORM_SPEC: PlatformSpec = {
  captionCharLimit: 2200,
  aspectRatio: '1:1 (square) recommended',
  guidance: 'No platform-specific guidance yet — using conservative defaults.',
};

/** Looks up a platform's spec, falling back to `DEFAULT_PLATFORM_SPEC` for an unlisted platform. */
export function getPlatformSpec(platform: string): PlatformSpec {
  return PLATFORM_SPECS[platform] ?? DEFAULT_PLATFORM_SPEC;
}
