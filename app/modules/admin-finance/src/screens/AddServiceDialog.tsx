// JobCore screen #0102 - af-addServiceDialog - Add Service
/**
 * AddServiceDialog — modal form for creating a new Service (a task group).
 *
 * Does not import the repo layer; the caller injects `onCreate`, which
 * performs the actual save and returns the new service or a reason.
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, ScrollView, StyleSheet } from 'react-native';
import { PayrollButton, Text, TextField, colors, spacing, typography, radius } from '@jobcore/ui';

export type AddServiceDialogProps = {
  visible: boolean;
  onCancel: () => void;
  onCreate: (name: string) => Promise<{ ok: true; value: { id: string; name: string } } | { ok: false; reason: string }>;
  onCreated: (service: { id: string; name: string }) => void;
  testID?: string;
};

export function AddServiceDialog({ visible, onCancel, onCreate, onCreated, testID }: AddServiceDialogProps) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const resetForm = () => {
    setName('');
    setPending(false);
    setError(undefined);
  };

  useEffect(() => {
    if (!visible) resetForm();
  }, [visible]);

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Name is required.');
      return;
    }
    setError(undefined);
    setPending(true);
    const result = await onCreate(trimmed);
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    resetForm();
    onCreated(result.value);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel} testID={testID}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView style={styles.scroll}>
            <Text style={styles.title}>Add Service</Text>
            <TextField
              inline
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Service name"
              style={styles.field}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.actions}>
              <PayrollButton label="Cancel" onPress={handleCancel} disabled={pending} />
              <PayrollButton
                label={pending ? 'Saving…' : 'Add Service'}
                onPress={handleCreate}
                disabled={pending || name.trim() === ''}
                style={styles.createButton}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    maxHeight: '85%',
    padding: spacing.md,
  },
  scroll: { maxHeight: '100%' },
  title: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  field: { marginBottom: spacing.sm },
  error: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm },
  createButton: { marginLeft: spacing.sm },
});
