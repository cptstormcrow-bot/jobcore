/**
 * Overview — default Sales & Marketing landing view: open callback tasks,
 * recent reviews, and reporting totals. Totals reuse Reporting's exported
 * aggregation helpers rather than duplicating them.
 */

import * as React from 'react';
import { View, ActivityIndicator, StyleSheet, ScrollView, Pressable } from 'react-native';
import { colors, Text } from '@jobcore/ui';
import { getModulePorts } from '../lib/module-ports';
import { getModuleSession } from '../lib/module-session';
import type { CallbackTask, Review, CampaignLogEntry, MarketingAsset } from '../data/ports';
import { buildPostsByPlatformAndPeriod, buildReviewsByPlatform } from './Reporting';

const TOP_N = 3;

type OverviewProps = { onOpenReviewLibrary?: () => void };

export function Overview({ onOpenReviewLibrary }: OverviewProps): React.ReactElement {
  const session = getModuleSession();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tasks, setTasks] = React.useState<CallbackTask[]>([]);
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [logEntries, setLogEntries] = React.useState<CampaignLogEntry[]>([]);
  const [assets, setAssets] = React.useState<MarketingAsset[]>([]);

  React.useEffect(() => {
    if (session === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { callbackTasks, reviews: reviewsPort, campaignLog, marketingAssets } = getModulePorts();
    const organizationId = session.org.id;
    Promise.all([
      callbackTasks.listOpen(organizationId),
      reviewsPort.list(organizationId),
      campaignLog.listForOrganization(organizationId),
      marketingAssets.list(organizationId),
    ])
      .then(([t, r, l, a]) => {
        setTasks(t);
        setReviews(r);
        setLogEntries(l);
        setAssets(a);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load overview.');
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (session === null || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const recentReviews = [...reviews]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, TOP_N);
  const reviewsByPlatform = buildReviewsByPlatform(reviews);
  const postsTotal = buildPostsByPlatformAndPeriod(logEntries).reduce((n, r) => n + r.count, 0);
  const assetsUsed = assets.filter((a) => a.approvedForPublic).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Open callback tasks ({tasks.length})</Text>
        {tasks.length === 0 && <Text style={styles.emptyText}>No open callback tasks.</Text>}
        {tasks.slice(0, TOP_N).map((t) => (
          <View key={t.jobId} style={styles.row}>
            <Text style={styles.rowLabel}>{t.customerName ?? 'Unknown customer'}</Text>
            <Text style={styles.rowValue}>{t.customerPhone ?? ''}</Text>
          </View>
        ))}

        {onOpenReviewLibrary !== undefined ? (
          <Pressable accessibilityRole="link" onPress={onOpenReviewLibrary}>
            <Text style={[styles.sectionTitle, styles.sectionLink]}>Recent reviews</Text>
          </Pressable>
        ) : (
          <Text style={styles.sectionTitle}>Recent reviews</Text>
        )}
        {recentReviews.length === 0 && <Text style={styles.emptyText}>No reviews yet.</Text>}
        {recentReviews.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowLabel}>
              {r.authorDisplayName ?? 'Anonymous'} · {r.platform}
            </Text>
            <Text style={styles.rowValue}>{r.rating}★</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Reporting totals</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Posts logged</Text>
          <Text style={styles.rowValue}>{postsTotal}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Assets approved for public use</Text>
          <Text style={styles.rowValue}>
            {assetsUsed} / {assets.length}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Reviews collected</Text>
          <Text style={styles.rowValue}>{reviews.length}</Text>
        </View>
        {reviewsByPlatform.map((p) => (
          <View key={p.platform} style={styles.row}>
            <Text style={styles.rowLabel}>{p.platform}</Text>
            <Text style={styles.rowValue}>{p.count}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  scrollContent: { paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingLeft: 16 },
  sectionLink: { color: colors.info, textDecorationLine: 'underline' },
  rowLabel: { flex: 1 },
  rowValue: { fontWeight: '600' },
  emptyText: { opacity: 0.7, paddingLeft: 16 },
  errorText: { color: colors.danger },
});

export default Overview;
