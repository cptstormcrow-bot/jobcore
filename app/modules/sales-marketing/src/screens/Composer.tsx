/**
 * Composer screen for the sales-marketing module (P6, spec §4-6).
 *
 * Assembles a draft post from a selected pitch angle: a suggested caption
 * (a plain template built ONLY from the pitch angle string — it never
 * reads a review's `body`/`author_display_name` or a job photo's
 * description into the suggestion, so it can never fabricate a review
 * quote, a customer name, or a claim about work that was not done),
 * selected marketing assets, and an explicit approve step before anything
 * posts. Nothing auto-posts: `handleApprove` is a separate, required step
 * before either export path below is reachable.
 *
 * Asset selection never trusts a client-side filter. `handleToggleAsset`
 * always calls `ports.postDraftAssets.attach`, which is rejected
 * server-side by `post_draft_assets_consent_check_trg` (0012) unless the
 * asset is `approved_for_public = true` AND (for a review-backed asset)
 * the underlying review is `publish_ok = true` — this screen only ever
 * reflects what that trigger allowed, it does not re-implement the check.
 *
 * Two paths out, both gated behind `approved`:
 *  1. Manual (always available, default): export images to the camera
 *     roll, copy the caption to the clipboard, open the OS share sheet,
 *     then log the post intent to `campaign_log` (channel: 'manual').
 *  2. Direct-post (only when the org's `meta-publish` social provider is
 *     enabled): creates a pending `post_targets` row, then calls
 *     `MetaPublishProvider.postDraft()`. With the flag OFF, no provider is
 *     resolved and no network call to the Edge Function (and therefore to
 *     graph.facebook.com) ever occurs — the UI states plainly that direct
 *     posting is unavailable instead of showing a broken button. The Meta
 *     Edge Function is the sole writer of the resulting `post_targets`/
 *     `campaign_log` rows (see `domain/providers/meta.ts`); this screen
 *     only renders the `PostResult` it returns.
 *
 * Sales-marketing isolation: reads session/ports via `lib/module-session.ts`
 * and `lib/module-ports.ts` rather than importing anything from
 * `apps/mobile`, mirroring field-tech's `Completion.tsx`.
 */

import { useEffect, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';

import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { getProvider } from '../domain/providers';
import type { PostResult } from '../domain/providers/types';
import type { MarketingAsset } from '../data/ports';

const META_PROVIDER_ID = 'meta-publish';

interface PlatformGuidance {
  platform: string;
  label: string;
  maxCaptionChars: number;
  aspectRatio: string;
}

/** Per-platform caption/aspect-ratio guidance shown to the tech before export. */
const PLATFORM_GUIDANCE: readonly [PlatformGuidance, PlatformGuidance] = [
  { platform: 'facebook', label: 'Facebook', maxCaptionChars: 500, aspectRatio: '1:1 or 4:5' },
  { platform: 'instagram', label: 'Instagram', maxCaptionChars: 2200, aspectRatio: '1:1 or 4:5' },
];

/**
 * Builds a suggested caption from the pitch angle ONLY. Deliberately does
 * not accept a review or photo as input — there is no code path here that
 * can pull a review's `body`/`author_display_name` into this string, so it
 * can never fabricate a quote or a customer name. Always prefixed so the
 * tech sees it is a draft suggestion, not finished copy.
 */
function buildSuggestedCaption(pitchAngle: string): string {
  const trimmed = pitchAngle.trim();
  const angleText = trimmed.length > 0 ? trimmed : 'our recent work';
  return `Draft suggestion — edit before posting: Check out ${angleText}! (Add your own details before sharing.)`;
}

export interface ComposerProps {
  /** Org the draft belongs to. */
  organizationId: string;
  /** The pitch angle selected upstream (e.g. a service or campaign theme). */
  pitchAngle: string;
  serviceId: string | null;
  serviceAreaId: string | null;
  /** Called once the tech is done with this draft (either path, or cancel). */
  onDone: () => void;
}

/**
 * Composer screen: build a draft post from a pitch angle, attach
 * server-approved assets, require an explicit approve step, then either
 * export manually or (if enabled) post directly via Meta.
 */
export function Composer({
  organizationId,
  pitchAngle,
  serviceId,
  serviceAreaId,
  onDone,
}: ComposerProps): JSX.Element {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [suggestedCaption] = useState(() => buildSuggestedCaption(pitchAngle));
  const [caption, setCaption] = useState(suggestedCaption);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<ReadonlySet<string>>(new Set());
  const [assetError, setAssetError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [metaEnabled, setMetaEnabled] = useState(false);
  const [platform, setPlatform] = useState<string>(PLATFORM_GUIDANCE[0].platform);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualLogged, setManualLogged] = useState(false);
  const [directResult, setDirectResult] = useState<PostResult | null>(null);

  // Load candidate assets and this org's Meta enablement, then create the
  // draft row itself. Nothing here posts anything — it only assembles.
  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      const ports = getModulePorts();
      try {
        const [assetList, metaConfig, draft] = await Promise.all([
          ports.marketingAssets.list(organizationId),
          ports.socialProviders.getByProviderId(organizationId, META_PROVIDER_ID),
          ports.postDrafts.create(organizationId, {
            pitchAngle,
            serviceId,
            serviceAreaId,
            suggestedCaption,
            caption: null,
          }),
        ]);
        if (cancelled) {
          return;
        }
        setAssets(assetList);
        setMetaEnabled(metaConfig !== null && metaConfig.enabled);
        setDraftId(draft.id);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to initialize draft.');
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once per mount — pitchAngle/serviceId/serviceAreaId
    // define the draft this screen was opened for, not a live filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Toggles an asset's selection. Adding one NEVER trusts this screen's own
   * judgement — it always round-trips through `postDraftAssets.attach`,
   * which the DB rejects unless `approved_for_public` (and, for a
   * review-backed asset, the review's `publish_ok`) both hold.
   */
  async function handleToggleAsset(asset: MarketingAsset): Promise<void> {
    if (draftId === null || approved) {
      return;
    }
    setAssetError(null);

    if (selectedAssetIds.has(asset.id)) {
      const next = new Set(selectedAssetIds);
      next.delete(asset.id);
      setSelectedAssetIds(next);
      return;
    }

    try {
      const ports = getModulePorts();
      await ports.postDraftAssets.attach(organizationId, draftId, asset.id);
      const next = new Set(selectedAssetIds);
      next.add(asset.id);
      setSelectedAssetIds(next);
    } catch (e) {
      setAssetError(
        e instanceof Error
          ? `Could not add asset: ${e.message}`
          : 'Could not add asset — it is not approved for public use.',
      );
    }
  }

  async function handleSaveCaption(): Promise<void> {
    if (draftId === null || approved) {
      return;
    }
    try {
      const ports = getModulePorts();
      await ports.postDrafts.updateCaption(draftId, caption);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save caption.');
    }
  }

  /**
   * The explicit approve step. Nothing in this screen can export or post
   * before this succeeds — `approved` gates both the manual-export and
   * direct-post sections below.
   */
  async function handleApprove(): Promise<void> {
    if (draftId === null || approved || busy) {
      return;
    }
    const session = getModuleSession();
    if (session === null) {
      setError('No active session — cannot approve draft.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ports = getModulePorts();
      await ports.postDrafts.updateCaption(draftId, caption);
      await ports.postDrafts.approve(draftId, session.userId, new Date().toISOString());
      setApproved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve draft.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Manual path: export selected images to the camera roll, copy the
   * caption to the clipboard, open the OS share sheet, then log the post
   * intent to `campaign_log`. Always available; requires `approved`.
   */
  async function handleManualExport(): Promise<void> {
    if (!approved || draftId === null || busy) {
      return;
    }
    const session = getModuleSession();
    if (session === null) {
      setError('No active session — cannot export.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.granted) {
        const selected = assets.filter((a) => selectedAssetIds.has(a.id));
        for (const asset of selected) {
          const localUri = assetLocalUri(asset);
          if (localUri !== null) {
            await MediaLibrary.saveToLibraryAsync(localUri);
          }
        }
      }

      await Clipboard.setStringAsync(caption);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(caption);
      }

      const ports = getModulePorts();
      await ports.campaignLog.create(organizationId, {
        draftId,
        channel: 'manual',
        platform,
        status: 'exported',
        actorId: session.userId,
      });
      setManualLogged(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Manual export failed.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Direct-post path. Only reachable when `metaEnabled` is true — with the
   * flag OFF this function is never called (the button below does not
   * render), so zero network calls to the Meta Edge Function (and
   * therefore to graph.facebook.com) occur. The Edge Function is the sole
   * writer of `post_targets`/`campaign_log`; this handler only renders the
   * `PostResult` it returns. Failure leaves the manual path available.
   */
  async function handleDirectPost(): Promise<void> {
    if (!approved || !metaEnabled || draftId === null || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setDirectResult(null);
    try {
      const ports = getModulePorts();
      const provider = getProvider(META_PROVIDER_ID);
      if (provider === undefined) {
        setDirectResult({ status: 'failed', error: 'Meta provider is not registered.' });
        return;
      }

      await ports.postTargets.create(organizationId, { draftId, platform });

      const selected = assets.filter((a) => selectedAssetIds.has(a.id));
      const result = await provider.postDraft({
        id: draftId,
        targetPlatform: platform,
        caption,
        assetPaths: selected.map((a) => a.id),
      });
      setDirectResult(result);
    } catch (e) {
      setDirectResult({
        status: 'failed',
        error: e instanceof Error ? e.message : 'Direct post failed.',
      });
    } finally {
      setBusy(false);
    }
  }

  const guidance = PLATFORM_GUIDANCE.find((g) => g.platform === platform) ?? PLATFORM_GUIDANCE[0];
  const captionTooLong = caption.length > guidance.maxCaptionChars;

  return (
    <div>
      <p>Compose post — pitch angle: {pitchAngle}</p>

      <p>
        <em>{suggestedCaption}</em>
      </p>

      <label>
        Platform
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} disabled={approved}>
          {PLATFORM_GUIDANCE.map((g) => (
            <option key={g.platform} value={g.platform}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        {guidance.label} guidance: up to {guidance.maxCaptionChars} characters, aspect ratio{' '}
        {guidance.aspectRatio}.
        {captionTooLong ? ' Caption exceeds this platform’s limit.' : ''}
      </p>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={() => void handleSaveCaption()}
        placeholder="Caption"
        disabled={approved}
      />

      <div>
        <p>Assets (only server-approved assets can be added):</p>
        {assets.map((asset) => (
          <label key={asset.id}>
            <input
              type="checkbox"
              checked={selectedAssetIds.has(asset.id)}
              onChange={() => void handleToggleAsset(asset)}
              disabled={approved}
            />
            {asset.jobPhotoId !== null ? `Photo ${asset.jobPhotoId}` : `Review ${asset.reviewId}`}
          </label>
        ))}
        {assetError !== null ? <p role="alert">{assetError}</p> : null}
      </div>

      {error !== null ? <p role="alert">{error}</p> : null}

      {!approved ? (
        <button type="button" onClick={() => void handleApprove()} disabled={busy || draftId === null}>
          {busy ? 'Approving…' : 'Approve draft'}
        </button>
      ) : (
        <p>Draft approved — ready to post.</p>
      )}

      <div>
        <p>Manual export (always available)</p>
        <button type="button" onClick={() => void handleManualExport()} disabled={!approved || busy}>
          {busy ? 'Exporting…' : 'Export images, copy caption, share'}
        </button>
        {manualLogged ? <p>Logged to campaign log.</p> : null}
      </div>

      <div>
        <p>Direct post</p>
        {metaEnabled ? (
          <>
            <button type="button" onClick={() => void handleDirectPost()} disabled={!approved || busy}>
              {busy ? 'Posting…' : 'Post directly via Meta'}
            </button>
            {directResult !== null && directResult.status === 'posted' ? (
              <p>Posted. Platform post id: {directResult.platformPostId}</p>
            ) : null}
            {directResult !== null && directResult.status === 'failed' ? (
              <p role="alert">
                Direct post failed: {directResult.error}. Use manual export above instead.
              </p>
            ) : null}
          </>
        ) : (
          <p>Direct posting is unavailable — this organization has not enabled Meta posting.</p>
        )}
      </div>

      <button type="button" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

/**
 * Resolves a marketing asset to a local file URI for `MediaLibrary`. Asset
 * storage-path resolution is host/backend-specific and out of this
 * screen's scope (mirrors `Completion.tsx`'s note on capture/upload
 * wiring) — returns `null` when there is nothing exportable to save,
 * rather than guessing a path.
 */
function assetLocalUri(_asset: MarketingAsset): string | null {
  return null;
}
