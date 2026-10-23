import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { PayrollButton, colors, radius, spacing } from '@jobcore/ui';
import { createCloseOutPhotosRepository } from '../lib/admin-finance-repos';
import { toUserMessage } from '../lib/offline-mutations';
import { readPhotoNote } from '../lib/photo-note';

export interface PhotoNoteFieldProps {
  photo: { id: string; uri: string; storagePath?: string };
  onSaved?: (note: string) => void;
}

const isJpeg = (s?: string): boolean => !!s && /\.jpe?g$/i.test((s.split('?')[0] ?? ''));

export function PhotoNoteField({ photo, onSaved }: PhotoNoteFieldProps) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const jpegOk = isJpeg(photo.uri) && (photo.storagePath === undefined || isJpeg(photo.storagePath));

  useEffect(() => {
    let alive = true;
    void readPhotoNote(photo.uri).then((n) => {
      if (!alive) return;
      setText(n ?? '');
      setSaved(n ?? '');
    });
    return () => {
      alive = false;
    };
  }, [photo.uri]);

  const canSave = jpegOk && !busy && !!photo.storagePath && text !== saved;

  const save = async () => {
    if (!photo.storagePath) return;
    setBusy(true);
    try {
      await createCloseOutPhotosRepository().setNote({ id: photo.id, storagePath: photo.storagePath }, text);
      setSaved(text);
      onSaved?.(text);
    } catch (e) {
      Alert.alert('Could not save note', toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        style={[styles.input, !jpegOk ? styles.inputDisabled : null]}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={500}
        editable={jpegOk}
        placeholder="Photo note"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Photo note"
      />
      {!jpegOk ? <Text style={styles.helper}>Notes need a JPEG photo.</Text> : null}
      <PayrollButton label="Save Note" onPress={() => void save()} disabled={!canSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  inputDisabled: { backgroundColor: colors.surfaceAlt, color: colors.textMuted },
  helper: { color: colors.textMuted, fontSize: 12 },
});
