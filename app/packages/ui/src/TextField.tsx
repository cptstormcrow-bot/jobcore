import React from 'react';
import { View, Text, TextInput, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from './tokens';

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  error?: string;
  style?: StyleProp<ViewStyle>;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  disabled = false,
  error,
  style,
}: TextFieldProps) {
  const hasError = !!error;
  return (
    <View style={[styles.base, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        editable={!disabled}
        accessibilityLabel={label ?? placeholder}
        accessibilityState={{ disabled }}
        aria-invalid={hasError}
        accessibilityHint={hasError ? error : undefined}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          hasError && styles.inputError,
          disabled && styles.disabled,
        ]}
      />
      {hasError && <Text style={styles.errorText}>{error}</Text>}
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  disabled: { opacity: 0.5 },
  errorText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
