import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { TruncatedText } from './TruncatedText';
import { colors, spacing, typography } from './tokens';

export interface ScreenTitleProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

export function ScreenTitle({ eyebrow, title, subtitle, style }: ScreenTitleProps) {
  return (
    <View style={style}>
      {eyebrow ? <TruncatedText style={styles.eyebrow}>{eyebrow}</TruncatedText> : null}
      <TruncatedText style={styles.title}>{title}</TruncatedText>
      {subtitle ? <TruncatedText style={styles.subtitle}>{subtitle}</TruncatedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.size.label,
  },
});
