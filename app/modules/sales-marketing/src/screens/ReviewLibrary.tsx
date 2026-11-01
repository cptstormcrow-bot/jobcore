// JobCore screen #0037 - sm-ReviewLibrary - Review Library
/**
 * ReviewLibrary — browsable list of published reviews (P6, Review library).
 *
 * Consumes `ReviewLibraryRepository` (`../data/ports.ts` via
 * `getModulePorts().reviews`), which ALWAYS scopes to `publish_ok = true`
 * server-side (`reviews_select_sales`, 0012) — this screen never adds its
 * own publish filter, matching `DayList`'s precedent of leaning on
 * server-side scoping rather than re-implementing it client-side.
 *
 * Filters (rating / service / community) map directly onto
 * `ReviewLibraryFilter` — `serviceId`/`communityId` filter on the review's
 * linked job's `service_id`/`service_area_id` via a server-side join, NOT a
 * column on `reviews` itself. The `Review` domain shape carries only
 * `jobId`, not the job's service/community display fields, so this screen
 * cannot render "job's service and community" as text (no such fields are
 * exposed on `Review` or anywhere in `ModulePorts`) — it shows the raw
 * `jobId` as a match reference instead, and never renders anything beyond
 * what `Review` exposes. This module's ports NEVER expose a query touching
 * `commissions`, `price_sheets`, or `payout_batches` (see `data/ports.ts`
 * scope fence) — this screen renders no such field, by construction, since
 * none exist on `Review`.
 *
 * Sort order mirrors the website's curation model: `sortOrder` defaults to
 * newest-first from the repository, but the sales user can explicitly
 * reorder rows via up/down controls, which call
 * `ReviewLibraryRepository.reorder` — the only write this screen performs,
 * matching `reviews_sales_sort_whitelist_trg` (0012) which permits nothing
 * else.
 *
 * Deliberately offers no "reviews with no response" / "low-rated only"
 * default view and no filter that singles out which customers get asked
 * for reviews — filters here only narrow which ALREADY-SUBMITTED published
 * reviews are visible, never anything about future review requests.
 */

import * as React from 'react';
import { View, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { PayrollButton, ScreenTitle, colors, Text, spacing, radius, typography } from '@jobcore/ui';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';
import type { Review, ReviewLibraryFilter } from '../data/ports';

const RATING_OPTIONS: readonly number[] = [0, 1, 2, 3, 4, 5];

export function ReviewLibrary(): React.ReactElement {
  const session = useModuleSession();

  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [minRating, setMinRating] = React.useState<number>(0);
  const [serviceId, setServiceId] = React.useState<string>('');
  const [communityId, setCommunityId] = React.useState<string>('');

  const [curatedIds, setCuratedIds] = React.useState<ReadonlySet<string>>(new Set());
  const [curateError, setCurateError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { reviews: reviewsRepository } = getModulePorts();
    const filter: ReviewLibraryFilter = {};
    if (minRating > 0) {
      filter.minRating = minRating;
    }
    if (serviceId.trim() !== '') {
      filter.serviceId = serviceId.trim();
    }
    if (communityId.trim() !== '') {
      filter.communityId = communityId.trim();
    }

    reviewsRepository
      .list(session.org.id, filter)
      .then((result) => {
        setReviews([...result].sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load reviews.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session, minRating, serviceId, communityId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleMove = React.useCallback(
    (review: Review, direction: -1 | 1) => {
      const index = reviews.findIndex((r) => r.id === review.id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= reviews.length) {
        return;
      }
      const target = reviews[targetIndex];
      if (target === undefined) {
        return;
      }
      if (session === null) {
        return;
      }

      const { reviews: reviewsRepository } = getModulePorts();
      Promise.all([
        reviewsRepository.reorder(review.id, target.sortOrder),
        reviewsRepository.reorder(target.id, review.sortOrder),
      ])
        .then(() => load())
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to reorder review.');
        });
    },
    [session, reviews, load],
  );

  const handleCurate = React.useCallback(
    (review: Review) => {
      if (session === null || curatedIds.has(review.id)) {
        return;
      }
      setCurateError(null);
      const { marketingAssets } = getModulePorts();
      marketingAssets
        .create(session.org.id, { jobPhotoId: null, reviewId: review.id })
        .then(() => {
          setCuratedIds((prev) => new Set(prev).add(review.id));
        })
        .catch((err: unknown) => {
          setCurateError(err instanceof Error ? err.message : 'Failed to curate review as testimonial.');
        });
    },
    [session, curatedIds],
  );

  if (session === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenTitle title="Review Library" />

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Minimum rating</Text>
        <View style={styles.ratingRow}>
          {RATING_OPTIONS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setMinRating(option)}
              style={[styles.ratingChip, minRating === option && styles.ratingChipActive]}
            >
              <Text style={[styles.ratingChipText, minRating === option && styles.ratingChipTextActive]}>
                {option === 0 ? 'Any' : `${option}+`}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.filterLabel}>Service</Text>
        <TextInput
          style={styles.input}
          value={serviceId}
          onChangeText={setServiceId}
          placeholder="Filter by service id"
          autoCapitalize="none"
        />

        <Text style={styles.filterLabel}>Community</Text>
        <TextInput
          style={styles.input}
          value={communityId}
          onChangeText={setCommunityId}
          placeholder="Filter by community id"
          autoCapitalize="none"
        />
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

      {curateError !== null && <Text style={styles.errorText}>{curateError}</Text>}

      {!loading && error === null && reviews.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No published reviews match these filters.</Text>
        </View>
      )}

      {!loading && error === null && reviews.length > 0 && (
        <FlatList
          data={reviews}
          keyExtractor={(review) => review.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <View style={styles.reorderControls}>
                <Pressable
                  accessibilityRole="button"
                  disabled={index === 0}
                  onPress={() => handleMove(item, -1)}
                  style={styles.reorderButton}
                >
                  <Text style={styles.reorderButtonText}>↑</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={index === reviews.length - 1}
                  onPress={() => handleMove(item, 1)}
                  style={styles.reorderButton}
                >
                  <Text style={styles.reorderButtonText}>↓</Text>
                </Pressable>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rating}>{'★'.repeat(item.rating)}{'☆'.repeat(Math.max(0, 5 - item.rating))}</Text>
                <Text style={styles.author}>{item.authorDisplayName ?? 'Anonymous'}</Text>
                {item.body !== null && <Text style={styles.body}>{item.body}</Text>}
                <Text style={styles.meta}>
                  {item.platform} · job {item.jobId} · {item.submittedAt}
                </Text>
                <PayrollButton
                  label={curatedIds.has(item.id) ? 'Curated' : 'Curate'}
                  disabled={curatedIds.has(item.id)}
                  onPress={() => handleCurate(item)}
                  style={styles.curateButton}
                />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  filters: {
    marginBottom: spacing.lg,
  },
  filterLabel: {
    fontSize: typography.size.small,
    color: colors.textMutedDark,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ratingChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.sandInactive,
  },
  ratingChipActive: {
    backgroundColor: colors.sand,
  },
  ratingChipText: {
    fontSize: typography.size.small,
    color: colors.text,
  },
  ratingChipTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.label,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.textMutedDark,
  },
  errorText: {
    color: colors.danger,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reorderControls: {
    marginRight: spacing.md,
    alignItems: 'center',
  },
  reorderButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  reorderButtonText: {
    fontSize: typography.size.body,
    fontWeight: '600',
  },
  rowBody: {
    flex: 1,
  },
  rating: {
    fontSize: 15,
    color: colors.primary,
  },
  author: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  body: {
    fontSize: typography.size.label,
    color: colors.text,
    marginTop: spacing.xs,
  },
  meta: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: spacing.xs,
  },
  curateButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
});

export default ReviewLibrary;
