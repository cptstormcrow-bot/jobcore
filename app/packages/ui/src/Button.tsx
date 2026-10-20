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

// Button is the general-purpose button and carries the app-wide Payroll look:
// padding 3 vertical / 11 horizontal, 1px transparent border (kept on every
// variant so the box never changes), radius 6, 14px label, no fixed height.
// PayrollButton (./PayrollButton) remains available.
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
  // Button: height comes from paddingBySize above (same at every size),
  // no minHeight, not a fixed 32pt. The Pressable's hitSlop (6/6/3/3) keeps the
  // tap target comfortable.
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
