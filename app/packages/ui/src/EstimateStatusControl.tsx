import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius, typography } from './tokens';

export type EstimateStatusChoice = 'draft' | 'submitted' | 'approved' | 'rejected';

export type EstimateStatusControlProps = {
  status: EstimateStatusChoice;
  allowed: readonly EstimateStatusChoice[];
  busy?: boolean;
  onSelect: (next: 'draft' | 'submitted' | 'approved') => void;
  testID?: string;
};

const CHIPS: readonly { value: 'draft' | 'submitted' | 'approved'; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
];

export function EstimateStatusControl({ status, allowed, busy = false, onSelect, testID }: EstimateStatusControlProps) {
  return (
    <View style={styles.row} testID={testID}>
      {CHIPS.map(({ value, label }) => {
        const selected = status === value;
        const disabled = busy || selected || !allowed.includes(value);
        return (
          <Pressable
            key={value}
            testID={`estimate-status-chip-${value}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(value)}
            style={[styles.chip, selected && styles.chipSelected, !selected && disabled && styles.dimmed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
      {status === 'rejected' ? (
        <View testID="estimate-status-pill-rejected" style={styles.pill}>
          <Text style={styles.pillLabel}>Rejected</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  chip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dimmed: { opacity: 0.45 },
  label: { fontFamily: typography.fontFamily.heading, fontWeight: typography.weight.semibold, fontSize: typography.size.label, color: colors.text },
  labelSelected: { color: colors.white },
  pill: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  pillLabel: { fontFamily: typography.fontFamily.heading, fontWeight: typography.weight.semibold, fontSize: typography.size.label, color: colors.textMuted },
});
