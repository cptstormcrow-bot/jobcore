import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { Card, PayrollButton, Text, radius, spacing } from '@jobcore/ui';
import { createCloseOutPhotosRepository as createNarrowPhotosRepository } from '../lib/admin-finance-repos';
import type { JobPhotoRepository } from '../../../../modules/admin-finance/src/data/ports';

// The factory is typed with the narrow CloseOutPhotoRepository alias; this card needs the host's wider JobPhotoRepository.
const createCloseOutPhotosRepository = () => createNarrowPhotosRepository() as unknown as JobPhotoRepository;
import { toUserMessage } from '../lib/offline-mutations';
import { beforePhotoFileName, beforePhotoSlot, MAX_BEFORE_PHOTOS, nextFreeBeforeSlot } from '../lib/job-photo-name';
import { pickJobPhoto } from '../lib/job-photo-picker';
import { PhotoNoteField } from './PhotoNoteField';

export interface JobBeforePhotoCardProps {
  jobId: string;
  jobNumber?: number | null;
  onSaved?: () => void;
}

interface BeforePhoto {
  id: string;
  uri: string;
  storagePath?: string;
}

export function JobBeforePhotoCard({ jobId, jobNumber, onSaved }: JobBeforePhotoCardProps) {
  const [photos, setPhotos] = useState<BeforePhoto[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const list = await createCloseOutPhotosRepository().listForJob(jobId, 'before');
    setPhotos(list.map((p) => ({ id: p.id, uri: p.uri, storagePath: p.storagePath })));
  }, [jobId]);

  useEffect(() => {
    let alive = true;
    createCloseOutPhotosRepository()
      .listForJob(jobId, 'before')
      .then((list) => {
        if (alive) setPhotos(list.map((p) => ({ id: p.id, uri: p.uri, storagePath: p.storagePath })));
      })
      .catch((e) => Alert.alert('Could not load photos', toUserMessage(e)));
    return () => {
      alive = false;
    };
  }, [jobId]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      onSaved?.();
    } catch (e) {
      Alert.alert('Photo error', toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addInSlot = async (source: 'camera' | 'library', slot: number) => {
    const asset = await pickJobPhoto(source);
    if (!asset) return false;
    await createCloseOutPhotosRepository().add(jobId, asset.uri, {
      kind: 'before',
      fileName: beforePhotoFileName(jobNumber, jobId, slot),
    });
    return true;
  };

  const addNew = (source: 'camera' | 'library') => {
    const slot = nextFreeBeforeSlot(photos.map((p) => p.storagePath ?? p.uri));
    if (slot === null) return;
    void run(async () => {
      await addInSlot(source, slot);
    });
  };

  const remove = (p: BeforePhoto) =>
    void run(async () => {
      await createCloseOutPhotosRepository().remove(p.id, p.storagePath);
    });

  const retake = (p: BeforePhoto) => {
    const slot = beforePhotoSlot(p.storagePath ?? p.uri);
    if (slot === null) {
      Alert.alert('Photo error', 'Could not tell which photo slot this is.');
      return;
    }
    void run(async () => {
      // Pick first so a cancelled camera does not lose the existing photo; then remove, then add into the same slot.
      const asset = await pickJobPhoto('camera');
      if (!asset) return;
      const repo = createCloseOutPhotosRepository();
      await repo.remove(p.id, p.storagePath);
      await repo.add(jobId, asset.uri, { kind: 'before', fileName: beforePhotoFileName(jobNumber, jobId, slot) });
    });
  };

  const full = photos.length >= MAX_BEFORE_PHOTOS;

  return (
    <Card>
      <Text>Take a photo of the job Before proceeding</Text>
      {photos.map((p) => (
        <View key={p.id} style={styles.item}>
          <Image source={{ uri: p.uri }} style={styles.thumb} resizeMode="cover" />
          <PhotoNoteField photo={{ id: p.id, uri: p.uri, storagePath: p.storagePath }} />
          <View style={styles.row}>
            <PayrollButton label="Retake" onPress={() => retake(p)} disabled={busy} />
            <PayrollButton label="Remove" onPress={() => remove(p)} disabled={busy} />
          </View>
        </View>
      ))}
      <View style={styles.row}>
        <PayrollButton label="Take Photo" onPress={() => addNew('camera')} disabled={busy || full} />
        <PayrollButton label="Choose Photo" onPress={() => addNew('library')} disabled={busy || full} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { marginVertical: spacing.sm, gap: spacing.sm },
  thumb: { width: 120, height: 120, borderRadius: radius.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
