import React from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius, typography } from './tokens';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'tab';
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Vertical metrics (padding + minHeight) are intentionally the SAME across every
// size — this is the deliberate, permanent, app-wide button standard (per user
// decision 2026-08-30): this exact uniform-height treatment applies to every
// button in the app, including every button added from now on. sm/md/lg/tab
// still differ by font size and horizontal padding only; height must never be
// split into per-size variants. minHeight uses the standard 44px mobile
// tap-target minimum, applied uniformly rather than per-size.
const paddingBySize = { sm: spacing.sm, md: spacing.sm, lg: spacing.sm, tab: spacing.sm } as const;
const fontBySize = { sm: typography.size.label, md: typography.size.body, lg: typography.size.h6, tab: typography.size.label } as const;
const minHeightBySize = { sm: 44, md: 44, lg: 44, tab: 44 } as const;
const paddingHorizontalBySize = { sm: spacing.lg, md: spacing.lg, lg: spacing.lg, tab: spacing.sm } as const;

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
      hitSlop={8}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          paddingVertical: paddingBySize[size],
          minHeight: minHeightBySize[size],
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
  // Height comes entirely from paddingBySize/minHeightBySize above (same value
  // at every size now) — no redundant minHeight here. This is well under the
  // WCAG 2.5.5 44px touch-target minimum; `hitSlop={8}` on the Pressable above
  // adds back an 8px hit-testing margin on all sides as a partial mitigation,
  // per explicit user instruction to prioritize on-screen density over that
  // guideline (tablet/phone space complaint).
  // borderWidth is reserved on `base` (not just `outline`) so toggling variant
  // never changes the rendered box size — only borderColor toggles, including
  // to 'transparent' when there's no visible border to draw.
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  outline: { borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  label: { fontFamily: typography.fontFamily.heading, fontWeight: typography.weight.semibold, textAlign: 'center' },
  labelPrimary: { fontFamily: typography.fontFamily.headingBold, fontWeight: typography.weight.bold },
});
