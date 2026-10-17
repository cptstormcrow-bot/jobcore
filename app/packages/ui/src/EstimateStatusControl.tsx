import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius, typography } from './tokens';

export type EstimateStatusChoice = 'draft' | 'submitted' | 'approved';

export type EstimateStatusControlProps = {
  status: EstimateStatusChoice;
  allowed: readonly EstimateStatusChoice[];
  busy?: boolean;
  onSelect: (next: EstimateStatusChoice) => void;
  testID?: string;
  /** Smaller font/padding for the right-hand column beside the tech rows. */
  compact?: boolean;
  /** Same visuals, no press handlers, nodes report disabled. */
  readOnly?: boolean;
};

const STEPS: readonly { value: EstimateStatusChoice; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
];

export function EstimateStatusControl({ status, allowed, busy = false, onSelect, testID, compact = false, readOnly = false }: EstimateStatusControlProps) {
  const currentIndex = STEPS.findIndex((s) => s.value === status);
  return (
    <View style={styles.row} testID={testID}>
      {STEPS.map(({ value, label }, index) => {
        const selected = status === value;
        const reached = index <= currentIndex;
        const pressable = !readOnly && !busy && !selected && allowed.includes(value);
        const connectorFilled = index <= currentIndex;
        return (
          <React.Fragment key={value}>
            {index > 0 ? (
              <View style={styles.connector} testID={`estimate-status-connector-${index}`}>
                <View style={[styles.line, connectorFilled && styles.lineFilled]} />
                <Text style={[styles.arrow, compact && styles.arrowCompact, connectorFilled && styles.arrowFilled]}>{'›'}</Text>
              </View>
            ) : null}
            <Pressable
              testID={`estimate-status-chip-${value}`}
              accessibilityRole="button"
              accessibilityLabel={`Estimate status: ${label}`}
              accessibilityState={{ selected, disabled: !pressable }}
              disabled={!pressable}
              onPress={pressable ? () => onSelect(value) : undefined}
              style={[
                styles.node,
                compact && styles.nodeCompact,
                reached && !selected && styles.nodeReached,
                selected && styles.nodeSelected,
                !reached && !pressable && styles.dimmed,
              ]}
            >
              <Text style={[styles.label, compact && styles.labelCompact, reached && !selected && styles.labelReached, selected && styles.labelSelected]}>{label}</Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  node: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sandInactive,
  },
  nodeCompact: { minHeight: 44, paddingHorizontal: spacing.xs },
  nodeReached: { borderColor: colors.primary, backgroundColor: colors.sandInactive },
  nodeSelected: { backgroundColor: colors.sand, borderColor: colors.primary },
  dimmed: { backgroundColor: colors.sandInactive },
  connector: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, flexGrow: 1, minWidth: 12 },
  line: { flex: 1, height: 2, backgroundColor: colors.border },
  lineFilled: { backgroundColor: colors.primary },
  arrow: { marginLeft: -2, fontSize: typography.size.label, color: colors.border },
  arrowCompact: { fontSize: typography.size.small },
  arrowFilled: { color: colors.primary },
  label: { fontFamily: typography.fontFamily.heading, fontWeight: typography.weight.semibold, fontSize: typography.size.label, color: colors.text },
  labelCompact: { fontSize: typography.size.small },
  labelReached: { color: colors.text },
  labelSelected: { color: colors.text },
});
