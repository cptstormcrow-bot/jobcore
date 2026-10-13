import React from 'react';
import { Pressable, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, spacing, typography } from './tokens';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  overline?: string;
  footer?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ListItem({ title, subtitle, overline, footer, onPress, right, style }: ListItemProps) {
  // A static (non-interactive) row gets no button role/label — only rows
  // with an onPress are announced as actionable, matching RN's own
  // guidance that accessibilityRole="button" implies tappability.
  const interactiveProps = onPress
    ? {
        accessibilityRole: 'button' as const,
        accessibilityLabel: [overline, title, subtitle, footer].filter(Boolean).join(', '),
      }
    : {};
  return (
    <View style={[styles.row, style]}>
      <Pressable onPress={onPress} {...interactiveProps} style={styles.main}>
        <View style={styles.content}>
          {overline ? <Text style={styles.overline}>{overline}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {footer ? <Text style={styles.footer}>{footer}</Text> : null}
        </View>
      </Pressable>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  main: { flexShrink: 1, flexGrow: 1 },
  content: { flexShrink: 1 },
  title: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
  subtitle: { color: colors.textMuted, fontSize: typography.size.small },
  overline: { color: colors.textMuted, fontSize: typography.size.small },
  footer: { color: colors.textMuted, fontSize: typography.size.small },
  right: { marginLeft: 'auto' },
});
