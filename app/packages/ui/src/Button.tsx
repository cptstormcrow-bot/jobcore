import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, typography } from './tokens';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'tab';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Button now follows the Payroll look and matches SandButton (./sand.ts):
// tight padding, radius 6, 14px label, same height at every size. No minHeight.
// A transparent 1px border is kept on every variant (so the outline variant does
// not change the box), absorbed in the padding: 4-1=3 vertical, 12-1=11 horizontal.
// SandButton remains the sand variant with the selected/testID extras.
const paddingBySize = { sm: 3, md: 3, lg: 3, tab: 3 } as const;
const fontBySize = { sm: 14, md: 14, lg: 14, tab: 14 } as const;
const paddingHorizontalBySize = { sm: 11, md: 11, lg: 11, tab: 11 } as const;

export function Button({ label, onPress, variant = 'primary', size = 'md', disabled = false, fullWidth = false, style }: ButtonProps) {
  const isOutline = variant === 'outline';
  // Rule G1: active = sand, disabled = sandInactive, dark text on all filled variants.
  const bg = isOutline ? 'transparent' : disabled ? colors.sandInactive : colors.sand;
  const labelColor = isOutline ? colors.primary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          paddingVertical: paddingBySize[size],
          paddingHorizontal: paddingHorizontalBySize[size],
        },
        isOutline && styles.outline,
        disabled && isOutline && styles.disabled,
        style,
        fullWidth && { alignSelf: 'stretch' },
      ]}
    >
      <Text style={[styles.label, (variant === 'primary' || variant === 'accent') && styles.labelPrimary, { color: labelColor, fontSize: fontBySize[size] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Button follows the Payroll look and matches SandButton: height comes from
  // paddingBySize above (same at every size), no minHeight. The Pressable's
  // per-side hitSlop (same as SandButton) keeps the tap target comfortable.
  // SandButton remains the sand variant with selected/testID extras.
  // borderWidth is reserved on `base` (not just `outline`) so toggling variant
  // never changes the rendered box size — only borderColor toggles, including
  // to 'transparent' when there's no visible border to draw.
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  outline: { borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  label: { fontFamily: typography.fontFamily.heading, fontWeight: typography.weight.semibold, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
  labelPrimary: { fontFamily: typography.fontFamily.headingBold, fontWeight: typography.weight.bold },
});
