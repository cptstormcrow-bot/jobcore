import React from 'react';
import { Pressable, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius, typography } from './tokens';

export interface CheckboxProps {
  label: string;
  /** Overrides the screen-reader name. Defaults to `label`; use it when the visual label is intentionally empty. */
  accessibilityLabel?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  /** 'box' (default) = filled box with dot; 'check' = bordered box with a bold checkmark glyph. */
  variant?: 'box' | 'check';
}

export function Checkbox({ label, accessibilityLabel, checked, onChange, disabled = false, style, boxStyle, variant = 'box' }: CheckboxProps) {
  const isCheck = variant === 'check';
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
      <View style={[styles.box, boxStyle, checked && (isCheck ? styles.boxCheckedOutline : styles.boxChecked)]}>
        {checked && (isCheck ? <Text style={styles.checkGlyph}>✓</Text> : <View style={styles.checkMark} />)}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Row is min 44 tall so the tap target meets the 44x44 minimum even
  // though the visual box (20x20) stays small; hitSlop above adds margin
  // on top of that for the box itself.
  base: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  disabled: { opacity: 0.5 },
  box: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxCheckedOutline: { borderColor: colors.primary },
  checkGlyph: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  checkMark: { width: 10, height: 10, borderRadius: radius.sm / 2, backgroundColor: colors.white },
  label: { fontFamily: typography.fontFamily.body, fontSize: typography.size.body, color: colors.text },
});
