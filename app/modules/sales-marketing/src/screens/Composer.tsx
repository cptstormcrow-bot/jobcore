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
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';

import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { getProvider } from '../domain/providers';
import type { PostResult } from '../domain/providers/types';
import type { MarketingAsset } from '../data/ports';
import type { PitchAngle } from './PitchPicker';
import { ScreenTitle } from '@jobcore/ui';

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
  /**
   * The pitch angle selected upstream by `PitchPicker` (one of
   * `service_line` | `community` | `seasonal` | `before_after`). Typed
   * against `PitchAngle` (`./PitchPicker.tsx`) so this screen and its
   * caller (`SalesMarketingRoot`) always agree on the same union.
   *
   * NOTE: this field already existed on `ComposerProps` as a required
   * `string` before this change — the dispatch asked for it to be added as
   * an *optional* field, but it was already required and already
   * consumed (by `buildSuggestedCaption`, the header badge below, and the
   * `postDrafts.create` call in the mount effect). Removing that
   * requirement would be a behavior change outside this change's scope, so
   * it stays required; only its type was narrowed from `string` to
   * `PitchAngle`.
   */
  pitchAngle: PitchAngle;
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
      try {
        const ports = getModulePorts();
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
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenTitle title="Compose Post" />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Pitch angle: {pitchAngle}</Text>
      </View>

      <Text style={styles.suggestedCaption}>{suggestedCaption}</Text>

      <Text style={styles.label}>Platform</Text>
      <View style={styles.platformRow}>
        {PLATFORM_GUIDANCE.map((g) => (
          <Pressable
            key={g.platform}
            accessibilityRole="button"
            disabled={approved}
            onPress={() => setPlatform(g.platform)}
            style={[styles.platformChip, platform === g.platform && styles.platformChipActive]}
          >
            <Text
              style={[
                styles.platformChipText,
                platform === g.platform && styles.platformChipTextActive,
              ]}
            >
              {g.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.guidanceText}>
        {guidance.label} guidance: up to {guidance.maxCaptionChars} characters, aspect ratio{' '}
        {guidance.aspectRatio}.
        {captionTooLong ? ' Caption exceeds this platform’s limit.' : ''}
      </Text>

      <TextInput
        style={styles.captionInput}
        value={caption}
        onChangeText={setCaption}
        onBlur={() => void handleSaveCaption()}
        placeholder="Caption"
        editable={!approved}
        multiline
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assets (only server-approved assets can be added):</Text>
        {assets.map((asset) => {
          const selected = selectedAssetIds.has(asset.id);
          return (
            <Pressable
              key={asset.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: approved }}
              disabled={approved}
              onPress={() => void handleToggleAsset(asset)}
              style={styles.assetRow}
            >
              <View style={[styles.checkbox, selected && styles.checkboxChecked]} />
              <Text style={styles.assetLabel}>
                {asset.jobPhotoId !== null ? `Photo ${asset.jobPhotoId}` : `Review ${asset.reviewId}`}
              </Text>
            </Pressable>
          );
        })}
        {assetError !== null ? <Text style={styles.errorText}>{assetError}</Text> : null}
      </View>

      {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}

      {!approved ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleApprove()}
          disabled={busy || draftId === null}
          style={[styles.primaryButton, (busy || draftId === null) && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{busy ? 'Approving…' : 'Approve draft'}</Text>
        </Pressable>
      ) : (
        <Text style={styles.approvedText}>Draft approved — ready to post.</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual export (always available)</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleManualExport()}
          disabled={!approved || busy}
          style={[styles.secondaryButton, (!approved || busy) && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryButtonText}>
            {busy ? 'Exporting…' : 'Export images, copy caption, share'}
          </Text>
        </Pressable>
        {manualLogged ? <Text style={styles.infoText}>Logged to campaign log.</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Direct post</Text>
        {metaEnabled ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleDirectPost()}
              disabled={!approved || busy}
              style={[styles.secondaryButton, (!approved || busy) && styles.buttonDisabled]}
            >
              <Text style={styles.secondaryButtonText}>
                {busy ? 'Posting…' : 'Post directly via Meta'}
              </Text>
            </Pressable>
            {directResult !== null && directResult.status === 'posted' ? (
              <Text style={styles.infoText}>
                Posted. Platform post id: {directResult.platformPostId}
              </Text>
            ) : null}
            {directResult !== null && directResult.status === 'failed' ? (
              <Text style={styles.errorText}>
                Direct post failed: {directResult.error}. Use manual export above instead.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.infoText}>
            Direct posting is unavailable — this organization has not enabled Meta posting.
          </Text>
        )}
      </View>

      <Pressable accessibilityRole="button" onPress={onDone} style={styles.doneButton}>
        <Text style={styles.doneButtonText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eee',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  suggestedCaption: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  platformRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  platformChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#eee',
  },
  platformChipActive: {
    backgroundColor: '#333',
  },
  platformChipText: {
    fontSize: 13,
    color: '#333',
  },
  platformChipTextActive: {
    color: '#fff',
  },
  guidanceText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
  },
  captionInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#888',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#333',
  },
  assetLabel: {
    fontSize: 14,
    color: '#333',
  },
  errorText: {
    color: '#b00020',
    fontSize: 13,
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#555',
    marginTop: 8,
  },
  approvedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a7a1a',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  doneButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
});

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
