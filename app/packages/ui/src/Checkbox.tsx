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
  /** 'box' (default) = filled box with dot; 'check' = bordered box with a bold checkmark glyph; 'tick' = checklist look (black 2px border always, green bold checkmark). */
  variant?: 'box' | 'check' | 'tick';
}

export function Checkbox({ label, accessibilityLabel, checked, onChange, disabled = false, style, boxStyle, variant = 'box' }: CheckboxProps) {
  const isCheck = variant === 'check';
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
      <View
        style={
          isTick
            ? [styles.box, styles.boxTick, boxStyle]
            : [styles.box, boxStyle, checked && (isCheck ? styles.boxCheckedOutline : styles.boxChecked)]
        }
      >
        {checked &&
          (isTick ? (
            <Text style={styles.tickGlyph}>✓</Text>
          ) : isCheck ? (
            <Text style={styles.checkGlyph}>✓</Text>
          ) : (
            <View style={styles.checkMark} />
          ))}
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
  // NOTE: 'tick' is the checklist look - black 2px border in both states, green check.
  boxTick: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.black },
  tickGlyph: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
    includeFontPadding: false,
  },
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
