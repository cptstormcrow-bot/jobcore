import React from 'react';
import { Pressable, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius, typography } from './tokens';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
}

export function Checkbox({ label, checked, onChange, disabled = false, style, boxStyle }: CheckboxProps) {
  return (
    <Pressable
      onPress={() => onChange?.(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      hitSlop={8}
      style={[styles.base, disabled && styles.disabled, style]}
    >
      <View style={[styles.box, boxStyle, checked && styles.boxChecked]}>
        {checked && <View style={styles.checkMark} />}
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
  checkMark: { width: 10, height: 10, borderRadius: radius.sm / 2, backgroundColor: colors.white },
  label: { fontFamily: typography.fontFamily.body, fontSize: typography.size.body, color: colors.text },
});
