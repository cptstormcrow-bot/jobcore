import React from 'react';
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from './tokens';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const paddingBySize = { sm: spacing.sm, md: spacing.md, lg: spacing.lg } as const;
const fontBySize = { sm: typography.size.label, md: typography.size.body, lg: typography.size.h6 } as const;

export function Button({ label, onPress, variant = 'primary', size = 'md', disabled = false, style }: ButtonProps) {
  const isOutline = variant === 'outline';
  const bg = variant === 'primary' ? colors.secondary : variant === 'secondary' ? colors.primary : 'transparent';
  const labelColor = isOutline ? colors.secondary : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        { backgroundColor: bg, paddingVertical: paddingBySize[size] },
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
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.md },
  outline: { borderWidth: 1, borderColor: colors.secondary },
  disabled: { opacity: 0.5 },
  label: { fontFamily: typography.fontFamily.heading, fontWeight: typography.weight.semibold },
});
