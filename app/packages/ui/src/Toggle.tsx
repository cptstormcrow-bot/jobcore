import React from 'react';
import { Pressable, Text, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from './tokens';

export interface ToggleProps {
  label?: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Toggle({ label, value, onChange, disabled = false, style }: ToggleProps) {
  return (
    <Pressable
      onPress={() => onChange?.(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      style={[styles.base, disabled && styles.disabled, style]}
    >
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: typography.fontFamily.body, fontSize: typography.size.body, color: colors.text, marginRight: spacing.sm },
  track: {
    width: 44,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  trackOn: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
  },
  thumbOn: { alignSelf: 'flex-end' },
});
