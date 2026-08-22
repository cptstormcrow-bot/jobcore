import React from 'react';
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from './tokens';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'tab';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const paddingBySize = { sm: spacing.sm, md: spacing.md, lg: spacing.lg, tab: spacing.sm } as const;
const fontBySize = { sm: typography.size.label, md: typography.size.body, lg: typography.size.h6, tab: typography.size.label } as const;
const minHeightBySize = { sm: 44, md: 44, lg: 44, tab: 32 } as const;
const paddingHorizontalBySize = { sm: spacing.lg, md: spacing.lg, lg: spacing.lg, tab: spacing.sm } as const;

export function Button({ label, onPress, variant = 'primary', size = 'md', disabled = false, style }: ButtonProps) {
  const isOutline = variant === 'outline';
  // White label text on colors.secondary (#E8740C) is ~3.0:1 contrast — under
  // WCAG AA's 4.5:1 for normal text. secondaryDark (#C46000, already a defined
  // brand token) raises that to ~4.2:1 without inventing a new color or
  // touching the sdassemblypro.com site palette itself.
  const bg = variant === 'primary' ? colors.secondaryDark : variant === 'secondary' ? colors.primary : 'transparent';
  // Same contrast reasoning applies to outline-variant text on white: use
  // secondaryDark, not secondary, so label text also clears ~4.2:1.
  const labelColor = isOutline ? colors.secondaryDark : colors.white;
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
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: labelColor, fontSize: fontBySize[size] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // minHeight 44 meets the WCAG 2.5.5 / RN-recommended minimum touch target
  // at every size; sm/md/lg still differ by padding and font size above it.
  // borderWidth is reserved on `base` (not just `outline`) so toggling variant
  // never changes the rendered box size — only borderColor toggles, including
  // to 'transparent' when there's no visible border to draw.
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  outline: { borderColor: colors.secondary },
  disabled: { opacity: 0.5 },
  label: { fontFamily: typography.fontFamily.heading, fontWeight: typography.weight.semibold },
});
