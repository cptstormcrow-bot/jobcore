/**
 * DEFAULT JobCore button spec - source: screen #0010 (Payroll) (registry #0010 = Admin & Finance root; Payroll = #88). Short (32pt) sand button,
 * label centered both ways; hitSlop keeps the 44pt touch target.
 * Future JobCore buttons use this component; never inline a one-off button style.
 */
import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { colors } from './tokens';

export interface PayrollButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'danger';
  /** Optional label override, e.g. a non-bold label on a dense screen. */
  textStyle?: StyleProp<TextStyle>;
  /** Slimmer 24pt button (top and bottom padding removed) for Delete buttons that sit against a neighbour; hitSlop grows to keep 44pt. */
  compact?: boolean;
}

export function PayrollButton({ label, onPress, disabled, accessibilityLabel, testID, style, tone, textStyle, compact }: PayrollButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={compact ? { top: 11, bottom: 11, left: 8, right: 8 } :{ top: 6, bottom: 6, left: 4, right: 4 }}
      testID={testID}
      style={[styles.button, tone === 'danger' ? { backgroundColor: colors.danger } : null, disabled ? styles.disabled : null, compact ? styles.compact : null, style]}
    >
      <Text numberOfLines={1} style={[styles.text, compact ? styles.compactText : null, tone === 'danger' ? { color: colors.white } : null, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // label-fit width: never stretch across a column parent (Jeff 2026-10-20)
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.sand,
  },
  // Gray outline so a grayed button stays visible on light screens (Jeff 2026-11-02); padding drops by the border so width holds.
  disabled: { backgroundColor: colors.sandDisabled, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11 },
  // Slim Delete: shorter, narrower padding and a smaller label so it stops reading as a full button (Jeff 2026-11-06).
  compact: { height: 22, paddingHorizontal: 8, borderRadius: 5 },
  compactText: { fontSize: 12, lineHeight: 14 },
  text: {
    color: '#000',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
