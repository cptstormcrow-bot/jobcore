// JobCore screen #0071 - af-addTaskDialog - Add Task
/**
 * AddTaskDialog — modal form for creating a new ServiceTask.
 *
 * Does not import the repo layer; the caller injects `onCreate`, which
 * performs the actual save and returns a CalculationResult<ServiceTask>.
 */

import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  PayrollButton,
  Text,
  TextField,
  Toggle,
  colors,
  spacing,
  typography,
  radius,
} from '@jobcore/ui';
import type { ServiceTask } from '../data/ports';

export type AddTaskDialogProps = {
  visible: boolean;
  serviceName?: string;
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    extra: {
      estimatedMinutes?: number | null;
      priceCents?: number | null;
      details?: string | null;
      materials?: string | null;
      category?: string | null;
      active?: boolean;
    };
  }) => Promise<{ ok: true; value: ServiceTask } | { ok: false; reason: string }>;
  onCreated: (task: ServiceTask) => void;
  testID?: string;
};

function parsePriceToCents(raw: string): { ok: true; value: number | null } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { ok: false, reason: 'Price must be a number ≥ 0.' };
  if (n < 0) return { ok: false, reason: 'Price must be a number ≥ 0.' };
  return { ok: true, value: Math.round(n * 100) };
}

function parseNonNegativeInt(raw: string): { ok: true; value: number | null } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return { ok: false, reason: 'Est. minutes must be a whole number ≥ 0.' };
  }
  return { ok: true, value: n };
}

export function AddTaskDialog({ visible, serviceName, onCancel, onCreate, onCreated, testID }: AddTaskDialogProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [minutes, setMinutes] = useState('');
  const [details, setDetails] = useState('');
  const [materials, setMaterials] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const resetForm = () => {
    setName('');
    setPrice('');
    setMinutes('');
    setDetails('');
    setMaterials('');
    setCategory('');
    setActive(true);
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
    const trimmedName = name.trim();
    if (trimmedName === '') {
      setError('Name is required.');
      return;
    }
    const priceResult = parsePriceToCents(price);
    if (!priceResult.ok) {
      setError(priceResult.reason);
      return;
    }
    const minutesResult = parseNonNegativeInt(minutes);
    if (!minutesResult.ok) {
      setError(minutesResult.reason);
      return;
    }
    setError(undefined);
    setPending(true);
    const result = await onCreate({
      name: trimmedName,
      extra: {
        estimatedMinutes: minutesResult.value,
        priceCents: priceResult.value,
        details: details.trim() === '' ? null : details,
        materials: materials.trim() === '' ? null : materials,
        category: category.trim() === '' ? null : category,
        active,
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    resetForm();
    onCreated(result.value);
  };

  const title = serviceName ? `Add Task — ${serviceName}` : 'Add Task';
  const createDisabled = pending || name.trim() === '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel} testID={testID}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator>
            <Text style={styles.title}>{title}</Text>

            <TextField label="Name" value={name} onChangeText={setName} placeholder="Task name" style={styles.field} />
            <TextField
              label="Price ($)"
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              style={styles.field}
            />
            <TextField
              label="Est. minutes"
              value={minutes}
              onChangeText={setMinutes}
              placeholder="0"
              style={styles.field}
            />
            <TextField label="Category" value={category} onChangeText={setCategory} style={styles.field} />
            <TextField
              label="Details"
              value={details}
              onChangeText={setDetails}
              multiline
              style={styles.field}
            />
            <TextField
              label="Materials"
              value={materials}
              onChangeText={setMaterials}
              multiline
              style={styles.field}
            />
            <Toggle label="Active" value={active} onChange={setActive} style={styles.field} />

            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <Pressable onPress={handleCancel} disabled={pending}>
                <PayrollButton label="Cancel" onPress={handleCancel} disabled={pending} />
              </Pressable>
              <PayrollButton
                label={pending ? 'Saving…' : 'Add Task'}
                onPress={handleCreate}
                disabled={createDisabled}
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
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    maxHeight: '85%',
    padding: spacing.md,
  },
  scroll: {
    maxHeight: '100%',
  },
  title: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.sm,
  },
  error: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  createButton: {
    marginLeft: spacing.sm,
  },
});
