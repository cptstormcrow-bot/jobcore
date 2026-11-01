// JobCore screen #0094 - job-region-photos - Photos
/**
 * Job Photos region: every photo for this job together, grouped by kind
 * (Before, After, then any other kind). Read-only; photos are taken on the
 * Estimate Tasks tab and at close-out. Opened from the Photos timeline dot,
 * which reads gray when the job has no photos but still opens this screen.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Card, EmptyState, LoadingState, Text, radius, spacing } from '@jobcore/ui';
import { createCloseOutPhotosRepository } from '../lib/admin-finance-repos';
import { toUserMessage } from '../lib/offline-mutations';

export type JobPhotosRegionProps = {
  jobId: string;
};

type JobPhoto = { id: string; uri: string; kind: string };

const KIND_ORDER = ['before', 'after'];

function kindLabel(kind: string): string {
  if (!kind) return 'Other';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function JobPhotosRegion({ jobId }: JobPhotosRegionProps) {
  const [photos, setPhotos] = useState<JobPhoto[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setPhotos(null);
    setError('');
    createCloseOutPhotosRepository()
      .listForJob(jobId)
      .then((list) => {
        if (alive) setPhotos(list.map((p) => ({ id: p.id, uri: p.uri, kind: p.kind ?? '' })));
      })
      .catch((e) => {
        if (alive) setError(toUserMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [jobId]);

  if (error) return <EmptyState title="Could not load photos" message={error} />;
  if (!photos) return <LoadingState />;
  if (photos.length === 0) return <EmptyState title="No photos for this job yet" />;

  const kinds = [...new Set(photos.map((p) => p.kind))].sort((a, b) => {
    const ia = KIND_ORDER.indexOf(a);
    const ib = KIND_ORDER.indexOf(b);
    return (ia < 0 ? KIND_ORDER.length : ia) - (ib < 0 ? KIND_ORDER.length : ib);
  });

  return (
    <View testID="job-photos">
      {kinds.map((kind) => (
        <Card key={kind || 'other'}>
          <Text>{kindLabel(kind)} photos</Text>
          <View style={styles.grid}>
            {photos.filter((p) => p.kind === kind).map((p) => (
              <Image key={p.id} source={{ uri: p.uri }} style={styles.thumb} resizeMode="cover" />
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  thumb: { width: 104, height: 104, borderRadius: radius.md },
});
