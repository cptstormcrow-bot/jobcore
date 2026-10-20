/**
 * DEFAULT JobCore button spec - source: screen #0010 (Payroll). Short (32pt) sand button,
 * label centered both ways; hitSlop keeps the 44pt touch target.
 * Future JobCore buttons use this component; never inline a one-off button style.
 */
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from './tokens';

export interface PayrollButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function PayrollButton({ label, onPress, disabled, accessibilityLabel, testID, style }: PayrollButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={{ top: 6, bottom: 6 }}
      testID={testID}
      style={[styles.button, disabled ? styles.disabled : null, style]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: colors.sand,
  },
  disabled: { backgroundColor: colors.sandInactive },
  text: {
    color: '#000',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
