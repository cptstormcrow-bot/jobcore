import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from './tokens';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  label?: string;
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Select({
  label,
  value,
  options,
  placeholder = 'Select...',
  onChange,
  disabled = false,
  style,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={[styles.base, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select'}
        accessibilityState={{ disabled }}
        style={[styles.trigger, disabled && styles.disabled]}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholderText]}>
          {selected ? selected.label : placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <ScrollView style={{ maxHeight: '100%' }}>
              {options.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={styles.row}
                >
                  <Text style={[styles.rowText, item.value === value && styles.rowTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { width: '100%' },
  label: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.medium,
    fontSize: typography.size.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  trigger: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  triggerText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
    fontWeight: typography.weight.semibold,
  },
  placeholderText: { color: colors.textMuted, fontWeight: typography.weight.regular },
  disabled: { opacity: 0.5 },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    maxHeight: '60%',
    paddingVertical: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
  },
  rowTextSelected: {
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
});
