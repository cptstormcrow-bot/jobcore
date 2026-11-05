import React, { useState } from 'react';
import { View, Pressable, Modal, ScrollView, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, compact, spacing, radius, typography } from './tokens';

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
  /** Label left of the trigger on one line. Default true (Jeff 2026-11-05); pass false to stack. */
  inline?: boolean;
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
  inline = true,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={[styles.base, inline && !!label && styles.baseInline, style]}>
      {label && <Text numberOfLines={1} style={[styles.label, inline && styles.labelInline]}>{inline ? `${label}:` : label}</Text>}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select'}
        accessibilityState={{ disabled }}
        style={[styles.trigger, compact && styles.triggerCompact, inline && !!label && styles.triggerInline, disabled && styles.disabled]}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholderText]} numberOfLines={1}>
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
  baseInline: { flexDirection: 'row', alignItems: 'center' },
  labelInline: { marginBottom: 0, marginRight: spacing.xs, flexShrink: 0 },
  triggerInline: { flex: 1 },
  label: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.medium,
    fontSize: typography.text.fieldLabel,
    color: colors.text,
    marginBottom: compact.gap,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: compact.field,
    minHeight: compact.rowMin,
    backgroundColor: colors.surface,
  },
  triggerCompact: {
    minHeight: 32,
    paddingVertical: spacing.xs / 2,
  },
  triggerText: {
    flex: 1,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.text.input,
    color: colors.text,
    fontWeight: typography.weight.semibold,
  },
  placeholderText: { color: colors.textMuted, fontWeight: typography.weight.regular },
  chevron: {
    marginLeft: spacing.sm,
    fontSize: typography.text.input,
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
    fontSize: typography.text.title,
    paddingVertical: spacing.sm,
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  row: {
    minHeight: 36,
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
    fontSize: typography.text.option,
    textAlign: 'center',
    color: colors.text,
  },
  rowTextSelected: {
    fontWeight: typography.weight.medium,
    color: colors.primary,
  },
});
