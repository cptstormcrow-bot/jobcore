import React from 'react';
import { Pressable, View, StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, compact, spacing, radius, typography } from './tokens';

export interface CheckboxProps {
  label: string;
  /** Overrides the screen-reader name. Defaults to `label`; use it when the visual label is intentionally empty. */
  accessibilityLabel?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Box border only: 'box' (default) = thin border; 'check' = thin border; 'tick' = black 2px border. Every variant fills the whole box green when checked. */
  variant?: 'box' | 'check' | 'tick';
}

export function Checkbox({ label, accessibilityLabel, checked, onChange, disabled = false, style, boxStyle, labelStyle, variant = 'box' }: CheckboxProps) {
  const isTick = variant === 'tick';
  return (
    <Pressable
      onPress={() => onChange?.(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked, disabled }}
      hitSlop={8}
      style={[styles.base, disabled && styles.disabled, style]}
    >
      {/* Every checkbox fills solid green when checked (Jeff 2026-11-02). */}
      <View
        style={[styles.box, isTick && styles.boxTick, boxStyle, checked && styles.boxChecked]}
      />
      <Text style={[styles.label, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Row is min 44 tall so the tap target meets the 44x44 minimum even
  // though the visual box (20x20) stays small; hitSlop above adds margin
  // on top of that for the box itself.
  base: { flexDirection: 'row', alignItems: 'center', minHeight: compact.rowMin },
  disabled: { opacity: 0.5 },
  box: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  // NOTE: 'tick' is the checklist look - black 2px border when unchecked.
  boxTick: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.black },
  // Applied last so it wins over boxStyle overrides: the whole box goes green.
  boxChecked: { backgroundColor: colors.success, borderColor: colors.success },
  label: { fontFamily: typography.fontFamily.body, fontSize: typography.text.fieldLabel, color: colors.text },
});
