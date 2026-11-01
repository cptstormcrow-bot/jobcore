import React, { useState } from 'react';
import { View, Pressable, Modal, ScrollView, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
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
  /** Heading shown at the top of the popup. */
  title?: string;
  /** Shorter trigger for dense lists. */
  compact?: boolean;
  /** Narrower popup sheet (field-tech pickers). */
  narrow?: boolean;
}

export function Select({
  label,
  value,
  options,
  placeholder = 'Select...',
  onChange,
  disabled = false,
  style,
  title,
  compact = false,
  narrow = false,
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
        style={[styles.trigger, compact && styles.triggerCompact, disabled && styles.disabled]}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholderText]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text
          style={styles.chevron}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          ▾
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, narrow && styles.sheetNarrow]}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <ScrollView style={{ maxHeight: '100%' }} showsVerticalScrollIndicator>
              {options.map((item, index) => (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={[styles.row, index < options.length - 1 && styles.rowDivider]}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  triggerCompact: {
    minHeight: 32,
    paddingVertical: spacing.xs / 2,
  },
  triggerText: {
    flex: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
    fontWeight: typography.weight.semibold,
  },
  placeholderText: { color: colors.textMuted, fontWeight: typography.weight.regular },
  chevron: {
    marginLeft: spacing.sm,
    fontSize: typography.size.body,
    color: colors.textMuted,
  },
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
    maxHeight: '80%',
    width: '80%',
    maxWidth: 320,
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  sheetNarrow: { width: '65%', maxWidth: 240 },
  title: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.h5,
    paddingVertical: spacing.sm,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  row: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  // colors.border (#E9ECEF) is too faint against the white sheet
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.h5,
    textAlign: 'center',
    color: colors.text,
  },
  rowTextSelected: {
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
});
