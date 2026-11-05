import React from 'react';
import { View, TextInput, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, compact, spacing, radius, typography } from './tokens';

// Value is an ISO date string ('YYYY-MM-DD') for RN/web portability — this
// package has no native calendar dependency, so selection is a validated
// text entry rather than a popover calendar (composed from RN core only,
// matching Button/TextField conventions).
export interface DatePickerProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  /** Label left of the box on one line. Default true (Jeff 2026-11-05); pass false to stack. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  disabled = false,
  error,
  inline = true,
  style,
}: DatePickerProps) {
  const invalid = value.length > 0 && !ISO_DATE_RE.test(value);
  const hasError = !!error || invalid;
  return (
    <View style={[styles.base, inline && !!label && styles.baseInline, style]}>
      {label && <Text numberOfLines={1} style={[styles.label, inline && styles.labelInline]}>{inline ? `${label}:` : label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        editable={!disabled}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={label ?? 'Date'}
        accessibilityState={{ disabled }}
        aria-invalid={hasError}
        accessibilityHint={hasError ? (error ?? 'Enter a date as YYYY-MM-DD') : undefined}
        style={[styles.input, inline && !!label && styles.inputInline, hasError && styles.inputError, disabled && styles.disabled]}
      />
      {hasError && <Text style={styles.errorText}>{error ?? 'Enter a date as YYYY-MM-DD'}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { width: '100%' },
  baseInline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  labelInline: { marginBottom: 0, marginRight: spacing.xs, flexShrink: 0 },
  inputInline: { flex: 1 },
  label: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.medium,
    fontSize: typography.text.fieldLabel,
    color: colors.text,
    marginBottom: compact.gap,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: compact.field,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.text.input,
    letterSpacing: typography.letterSpacing.normal,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  disabled: { opacity: 0.5 },
  errorText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.text.error,
    color: colors.danger,
    marginTop: compact.gap,
    width: '100%',
  },
});
