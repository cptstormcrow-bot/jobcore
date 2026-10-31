import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { Card, PayrollButton, Text, radius, spacing } from '@jobcore/ui';
import { createCloseOutPhotosRepository as createNarrowPhotosRepository } from '../lib/admin-finance-repos';
import type { JobPhotoRepository } from '../../../../modules/admin-finance/src/data/ports';

// The factory is typed with the narrow CloseOutPhotoRepository alias; this card needs the host's wider JobPhotoRepository.
const createCloseOutPhotosRepository = () => createNarrowPhotosRepository() as unknown as JobPhotoRepository;
import { toUserMessage } from '../lib/offline-mutations';
import { afterPhotoFileName, afterPhotoSlot, MAX_AFTER_PHOTOS, nextFreeAfterSlot } from '../lib/job-photo-name';
import { pickJobPhoto } from '../lib/job-photo-picker';
import { PhotoNoteField } from './PhotoNoteField';

export interface JobAfterPhotoCardProps {
  jobId: string;
  jobNumber?: number | null;
  onSaved?: () => void;
  // Called whenever the number of AFTER photos for the job changes, including the initial load.
  onCountChange?: (count: number) => void;
  // Disables capture and the note fields while the job is being submitted.
  disabled?: boolean;
}

interface AfterPhoto {
  id: string;
  uri: string;
  storagePath?: string;
}

export function JobAfterPhotoCard({ jobId, jobNumber, onSaved, onCountChange, disabled }: JobAfterPhotoCardProps) {
  const [photos, setPhotos] = useState<AfterPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const localIds = useRef(new Set<string>());
  const removedIds = useRef(new Set<string>());

  const reload = useCallback(async () => {
    const list = await createCloseOutPhotosRepository().listForJob(jobId, 'after');
    const fresh = list.map((p) => ({ id: p.id, uri: p.uri, storagePath: p.storagePath }));
    // Merge: keep locally added photos a stale cached list does not know about yet, and prefer the local uri.
    setPhotos((prev) => {
      const local = new Map(prev.filter((x) => localIds.current.has(x.id)).map((x) => [x.id, x]));
      const merged: AfterPhoto[] = fresh
        .filter((f) => !removedIds.current.has(f.id))
        .map((f) => (local.has(f.id) ? { ...f, uri: local.get(f.id)!.uri } : f));
      for (const l of local.values()) if (!merged.some((m) => m.id === l.id)) merged.push(l);
      return merged;
    });
  }, [jobId]);

  useEffect(() => {
    let alive = true;
    createCloseOutPhotosRepository()
      .listForJob(jobId, 'after')
      .then((list) => {
        if (alive) setPhotos(list.map((p) => ({ id: p.id, uri: p.uri, storagePath: p.storagePath })));
      })
      .catch((e) => Alert.alert('Could not load photos', toUserMessage(e)));
    return () => {
      alive = false;
    };
  }, [jobId]);

  useEffect(() => {
    onCountChange?.(photos.length);
  }, [photos.length, onCountChange]);

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

  const appendLocal = (added: { id: string; uri: string; storagePath?: string }) => {
    localIds.current.add(added.id);
    removedIds.current.delete(added.id);
    setPhotos((prev) => [
      ...prev.filter((x) => x.id !== added.id),
      { id: added.id, uri: added.uri, storagePath: added.storagePath },
    ]);
  };

  const dropLocal = (id: string) => {
    localIds.current.delete(id);
    removedIds.current.add(id);
    setPhotos((prev) => prev.filter((x) => x.id !== id));
  };

  const addInSlot = async (source: 'camera' | 'library', slot: number) => {
    const asset = await pickJobPhoto(source);
    if (!asset) return false;
    const added = await createCloseOutPhotosRepository().add(jobId, asset.uri, {
      kind: 'after',
      fileName: afterPhotoFileName(jobNumber, jobId, slot),
    });
    appendLocal(added);
    return true;
  };

  const addNew = (source: 'camera' | 'library') => {
    const slot = nextFreeAfterSlot(photos.map((p) => p.storagePath ?? p.uri));
    if (slot === null) return;
    void run(async () => {
      await addInSlot(source, slot);
    });
  };

  const remove = (p: AfterPhoto) =>
    void run(async () => {
      await createCloseOutPhotosRepository().remove(p.id, p.storagePath);
      dropLocal(p.id);
    });

  const retake = (p: AfterPhoto) => {
    const slot = afterPhotoSlot(p.storagePath ?? p.uri);
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
      dropLocal(p.id);
      const added = await repo.add(jobId, asset.uri, { kind: 'after', fileName: afterPhotoFileName(jobNumber, jobId, slot) });
      appendLocal(added);
    });
  };

  const full = photos.length >= MAX_AFTER_PHOTOS;
  const locked = busy || !!disabled;

  return (
    <Card>
      <Text>After photos</Text>
      {photos.length === 0 ? <Text>No after photos yet.</Text> : null}
      {photos.map((p) => (
        <View key={p.id} style={styles.item}>
          <Image source={{ uri: p.uri }} style={styles.thumb} resizeMode="cover" />
          {/* PhotoNoteField has no disabled prop; block touches and dim it while the job is submitting. */}
          <View pointerEvents={disabled ? 'none' : 'auto'} style={disabled ? styles.dimmed : undefined}>
            <PhotoNoteField photo={{ id: p.id, uri: p.uri, storagePath: p.storagePath }} />
          </View>
          <View style={styles.row}>
            <PayrollButton label="Retake" onPress={() => retake(p)} disabled={locked} />
            <PayrollButton label="Remove" onPress={() => remove(p)} disabled={locked} />
          </View>
        </View>
      ))}
      {full ? <Text>Maximum of {MAX_AFTER_PHOTOS} after photos reached.</Text> : null}
      <View style={styles.row}>
        <PayrollButton label="Capture After-photo" onPress={() => addNew('camera')} disabled={locked || full} />
        <PayrollButton label="Choose Photo" onPress={() => addNew('library')} disabled={locked || full} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { marginVertical: spacing.sm, gap: spacing.sm },
  thumb: { width: 120, height: 120, borderRadius: radius.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dimmed: { opacity: 0.5 },
});
