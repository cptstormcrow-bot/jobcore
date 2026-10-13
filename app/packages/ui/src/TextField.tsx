import React from 'react';
import { View, TextInput, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius, typography } from './tokens';

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  error?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Compact: label margin 0, xs padding, multiline minHeight 56. */
  dense?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  multiline = false,
  disabled = false,
  error,
  style,
  labelStyle,
  inputStyle,
  dense = false,
}: TextFieldProps) {
  const hasError = !!error;
  return (
    <View style={[styles.base, style]}>
      {label && <Text style={[styles.label, dense && styles.labelDense, labelStyle]}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
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
          dense && styles.inputDense,
          multiline && styles.inputMultiline,
          multiline && dense && styles.inputMultilineDense,
          hasError && styles.inputError,
          disabled && styles.disabled,
          inputStyle,
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
    color: colors.textMuted,
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
    letterSpacing: typography.letterSpacing.normal,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  labelDense: { marginBottom: 0 },
  inputDense: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  inputMultilineDense: { minHeight: 56 },
  inputError: { borderColor: colors.danger },
  disabled: { opacity: 0.5 },
  errorText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
