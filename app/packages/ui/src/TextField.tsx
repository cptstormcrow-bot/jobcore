import React from 'react';
import { View, TextInput, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from './Text';
import { colors, compact, spacing, radius, typography } from './tokens';

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  keyboardType?: import('react-native').KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  multiline?: boolean;
  disabled?: boolean;
  error?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Compact: label margin 0, xs padding, multiline minHeight 56. */
  dense?: boolean;
  /** Label sits left of the box on one line ("Customer name: ..."). Default true (Jeff 2026-11-05); pass false to stack. */
  inline?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  multiline = false,
  disabled = false,
  error,
  style,
  labelStyle,
  inputStyle,
  dense = false,
  inline = true,
}: TextFieldProps) {
  const hasError = !!error;
  return (
    <View style={[styles.base, inline && styles.baseInline, inline && multiline && styles.baseInlineTop, style]}>
      {label && (
        <Text
          numberOfLines={1}
          style={[styles.label, dense && styles.labelDense, inline && styles.labelInline, labelStyle]}
        >
          {inline ? `${label}:` : label}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
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
          inline && styles.inputInline,
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
  baseInline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  baseInlineTop: { alignItems: 'flex-start' },
  label: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.medium,
    fontSize: typography.text.fieldLabel,
    color: colors.textMuted,
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
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  labelDense: { marginBottom: 0 },
  labelInline: { marginBottom: 0, marginRight: spacing.xs, flexShrink: 0 },
  inputInline: { flex: 1, paddingVertical: compact.gap, minHeight: compact.rowMin },
  inputDense: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  inputMultilineDense: { minHeight: 56 },
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
