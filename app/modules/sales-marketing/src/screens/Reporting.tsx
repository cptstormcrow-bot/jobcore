/**
 * Reporting — non-financial marketing reporting screen (P6 §7).
 *
 * Aggregates client-side from three ports (`getModulePorts()`):
 *  - `campaignLog.listForOrganization` + `postTargets` (via each visible
 *    draft) for "posts by platform and period",
 *  - `marketingAssets.list` for "assets used" (approved-for-public count),
 *  - `reviews.list` for "reviews collected per service and community".
 *
 * `CampaignLogEntry.platform` already carries the platform for a log line,
 * so posts-by-platform is built directly off `campaignLog`, not by joining
 * through `postTargets` — `PostTarget` has no period/timestamp fitting a
 * "period" bucket the way `CampaignLogEntry.occurredAt` does. `postDrafts`
 * is read only to resolve `serviceId`/`serviceAreaId` labels for the review
 * breakdown request; see below for why review→service/community grouping
 * cannot be completed from what the ports expose.
 *
 * Scope fence (mirrors `data/ports.ts`): this screen renders NO paid-ads
 * buying/budget/audience-management UI, and no query here ever touches
 * `commissions`, `price_sheets`, or `payout_batches` — this module's ports
 * never expose those tables, so no such field can appear here by
 * construction. See the in-file banner below and
 * `modules/sales-marketing/README.md` for the paid-ads/Meta-Pixel note this
 * screen is required to surface.
 *
 * Reviews-per-service/community: `Review` (data/ports.ts) does not carry a
 * `serviceId`/`communityId` field directly — those live on the review's
 * linked job and are only reachable through `ReviewLibraryFilter`
 * (server-side join), not through any field returned on `Review` itself.
 * This screen therefore reports reviews grouped by `platform` (which IS on
 * `Review`) and separately surfaces total published-review count, rather
 * than fabricating a service/community grouping the ports cannot support.
 */

import * as React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { getModulePorts } from '../lib/module-ports';
import { getModuleSession } from '../lib/module-session';
import type { CampaignLogEntry, MarketingAsset, Review } from '../data/ports';

interface PlatformPeriodCount {
  platform: string;
  period: string;
  count: number;
}

function periodOf(isoTimestamp: string): string {
  // Month-granularity period bucket, e.g. "2026-08" — matches the
  // "period" language in the P6 spec without inventing a UI period picker.
  return isoTimestamp.slice(0, 7);
}

function buildPostsByPlatformAndPeriod(entries: readonly CampaignLogEntry[]): PlatformPeriodCount[] {
  const buckets = new Map<string, PlatformPeriodCount>();
  for (const entry of entries) {
    const platform = entry.platform ?? 'unknown';
    const period = periodOf(entry.occurredAt);
    const key = `${platform}::${period}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { platform, period, count: 1 });
    }
  }
  return [...buckets.values()].sort((a, b) => {
    if (a.period !== b.period) {
      return b.period.localeCompare(a.period);
    }
    return a.platform.localeCompare(b.platform);
  });
}

interface PlatformCount {
  platform: string;
  count: number;
}

function buildReviewsByPlatform(reviews: readonly Review[]): PlatformCount[] {
  const buckets = new Map<string, number>();
  for (const review of reviews) {
    buckets.set(review.platform, (buckets.get(review.platform) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => a.platform.localeCompare(b.platform));
}

export function Reporting(): React.ReactElement {
  const session = getModuleSession();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [postsByPlatformPeriod, setPostsByPlatformPeriod] = React.useState<PlatformPeriodCount[]>([]);
  const [assetsUsedCount, setAssetsUsedCount] = React.useState(0);
  const [assetsTotalCount, setAssetsTotalCount] = React.useState(0);
  const [reviewsByPlatform, setReviewsByPlatform] = React.useState<PlatformCount[]>([]);
  const [reviewsTotalCount, setReviewsTotalCount] = React.useState(0);

  const load = React.useCallback(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { campaignLog, marketingAssets, reviews } = getModulePorts();
    const organizationId = session.org.id;

    Promise.all([
      campaignLog.listForOrganization(organizationId),
      marketingAssets.list(organizationId),
      reviews.list(organizationId),
    ])
      .then(([logEntries, assets, publishedReviews]: [CampaignLogEntry[], MarketingAsset[], Review[]]) => {
        setPostsByPlatformPeriod(buildPostsByPlatformAndPeriod(logEntries));

        setAssetsTotalCount(assets.length);
        setAssetsUsedCount(assets.filter((asset) => asset.approvedForPublic).length);

        setReviewsByPlatform(buildReviewsByPlatform(publishedReviews));
        setReviewsTotalCount(publishedReviews.length);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load reporting data.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Marketing reporting</Text>

      <View style={styles.notice} accessibilityRole="text">
        <Text style={styles.noticeTitle}>Paid-ads reporting: out of scope</Text>
        <Text style={styles.noticeBody}>
          This screen reports organic posts, assets, and reviews only. Paid-ads reporting is out
          of scope for this module (see `modules/sales-marketing/README.md`) and is additionally
          BLOCKED until Meta Pixel is installed on the website. Installing Meta Pixel is the
          website owner&apos;s task, not this app&apos;s — this app cannot install it and will not
          build any paid-ads buying, budget, or audience-management UI.
        </Text>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      )}

      {!loading && error !== null && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && error === null && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Posts by platform and period</Text>
          {postsByPlatformPeriod.length === 0 && (
            <Text style={styles.emptyText}>No posting activity logged yet.</Text>
          )}
          {postsByPlatformPeriod.map((row) => (
            <View key={`${row.platform}::${row.period}`} style={styles.row}>
              <Text style={styles.rowLabel}>
                {row.platform} · {row.period}
              </Text>
              <Text style={styles.rowValue}>{row.count}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Assets used</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Approved for public use</Text>
            <Text style={styles.rowValue}>{assetsUsedCount}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total marketing assets</Text>
            <Text style={styles.rowValue}>{assetsTotalCount}</Text>
          </View>

          <Text style={styles.sectionTitle}>Reviews collected</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total published reviews</Text>
            <Text style={styles.rowValue}>{reviewsTotalCount}</Text>
          </View>
          {reviewsByPlatform.length === 0 && (
            <Text style={styles.emptyText}>No published reviews yet.</Text>
          )}
          {reviewsByPlatform.map((row) => (
            <View key={row.platform} style={styles.row}>
              <Text style={styles.rowLabel}>{row.platform}</Text>
              <Text style={styles.rowValue}>{row.count}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  notice: {
    backgroundColor: '#fff4e5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0a300',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7a4a00',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 13,
    color: '#7a4a00',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorText: {
    color: '#b00020',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    fontSize: 13,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowLabel: {
    fontSize: 14,
    color: '#333',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});

export default Reporting;
