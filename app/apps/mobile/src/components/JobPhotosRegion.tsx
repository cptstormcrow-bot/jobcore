// JobCore screen #0094 - job-region-photos - Photos
/**
 * Job Photos region: every photo for this job together, grouped by kind
 * (Before, After, then any other kind). Before photos are taken or picked
 * right here (same card as the Tasks tab); After photos come from close-out.
 * Opened from the Photos timeline dot, which reads gray when the job has no
 * photos but still opens this screen.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, LoadingState, PhotoThumb, Text, radius, spacing } from '@jobcore/ui';
import { JobBeforePhotoCard } from './JobBeforePhotoCard';
import { createCloseOutPhotosRepository } from '../lib/admin-finance-repos';
import { toUserMessage } from '../lib/offline-mutations';

export type JobPhotosRegionProps = {
  jobId: string;
  jobNumber?: number | null;
};

type JobPhoto = { id: string; uri: string; kind: string };

const KIND_ORDER = ['before', 'after'];
const LOAD_TIMEOUT_MS = 15000;

function kindLabel(kind: string): string {
  if (!kind) return 'Other';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function JobPhotosRegion({ jobId, jobNumber }: JobPhotosRegionProps) {
  const [photos, setPhotos] = useState<JobPhoto[] | null>(null);
  const [error, setError] = useState('');
  // Bumped when the before-photo card saves, so the grids below reload.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setPhotos(null);
    setError('');
    // Never spin forever: a load that has not finished in time shows an error the tech can see.
    const timer = setTimeout(() => {
      if (alive) setError('Photos took too long to load. Check your connection and open Photos again.');
    }, LOAD_TIMEOUT_MS);
    createCloseOutPhotosRepository()
      .listForJob(jobId)
      .then((list) => {
        if (!alive) return;
        setError('');
        setPhotos(list.map((p) => ({ id: p.id, uri: p.uri, kind: p.kind ?? '' })));
      })
      .catch((e) => {
        if (alive) setError(toUserMessage(e));
      })
      .finally(() => clearTimeout(timer));
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [jobId, reloadKey]);

  const beforeCard = (
    <JobBeforePhotoCard jobId={jobId} jobNumber={jobNumber} onSaved={() => setReloadKey((k) => k + 1)} />
  );

  if (error) return <View testID="job-photos">{beforeCard}<EmptyState title="Could not load photos" message={error} /></View>;
  if (!photos) return <View testID="job-photos">{beforeCard}<LoadingState /></View>;

  // Before photos live in the card above; the grids show every other kind.
  const others = photos.filter((p) => p.kind !== 'before');
  const kinds = [...new Set(others.map((p) => p.kind))].sort((a, b) => {
    const ia = KIND_ORDER.indexOf(a);
    const ib = KIND_ORDER.indexOf(b);
    return (ia < 0 ? KIND_ORDER.length : ia) - (ib < 0 ? KIND_ORDER.length : ib);
  });

  return (
    <View testID="job-photos">
      {beforeCard}
      {kinds.map((kind) => (
        <Card key={kind || 'other'}>
          <Text>{kindLabel(kind)} photos</Text>
          <View style={styles.grid}>
            {others.filter((p) => p.kind === kind).map((p) => (
              <PhotoThumb key={p.id} uri={p.uri} style={styles.thumb} />
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
