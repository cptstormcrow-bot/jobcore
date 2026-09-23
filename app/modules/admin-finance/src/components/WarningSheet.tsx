/**
 * Assignment warning sheet (P3g.4).
 *
 * Shows the `AssignmentWarning[]` `domain/assignment-warnings.ts`'s
 * `warningsFor` returns, before an assignment is confirmed
 * (`03-P3-admin-finance.md` §4: "Warn (do not hard-block) ..."). Warnings
 * here are advisory ONLY — the confirm button has no `disabled` prop tied to
 * `warnings.length` anywhere in this file, and must never gain one: staff
 * can always confirm the assignment regardless of how many warnings are
 * present.
 *
 * `@jobcore/ui` has no Modal/Sheet primitive, so this is composed from RN's
 * own `Modal` plus `Card`/`Button`, styled purely from `tokens.ts` — the
 * same "compose from primitives + tokens when no dedicated primitive
 * exists" rule `AxisPicker.tsx`/`TechColumn.tsx` follow. AC-11: zero raw
 * hex/rgba color literals in this file.
 */

import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { Button, Card, colors, spacing, radius, typography, Text } from '@jobcore/ui';
import type { AssignmentWarning } from '../domain/assignment-warnings';

export interface WarningSheetProps {
  visible: boolean;
  warnings: AssignmentWarning[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function WarningSheet({ visible, warnings, onConfirm, onCancel }: WarningSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Card style={styles.sheet}>
          <Text style={styles.title}>
            {warnings.length === 0 ? 'Confirm assignment' : 'Review before assigning'}
          </Text>
          {warnings.length === 0 ? (
            <Text style={styles.body}>No conflicts found.</Text>
          ) : (
            warnings.map((warning, index) => (
              <View key={`${warning.code}-${index}`} style={styles.warningRow}>
                <Text style={styles.warningText}>{warning.message}</Text>
              </View>
            ))
          )}
          <View style={styles.actions}>
            <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.actionButton} />
            {/*
              No `disabled` prop here, by design: warnings are advisory only
              (03-P3-admin-finance.md §4), never a hard block, so confirm
              stays enabled no matter what `warnings` contains.
            */}
            <Button
              label="Confirm assignment"
              variant="primary"
              onPress={onConfirm}
              style={styles.actionButton}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

export default WarningSheet;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.textLight,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
  },
  warningRow: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  warningText: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    minWidth: 120,
  },
});
