import React from 'react';
import { Pressable, View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, typography } from './tokens';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ListItem({ title, subtitle, onPress, right, style }: ListItemProps) {
  // A static (non-interactive) row gets no button role/label — only rows
  // with an onPress are announced as actionable, matching RN's own
  // guidance that accessibilityRole="button" implies tappability.
  const interactiveProps = onPress
    ? {
        accessibilityRole: 'button' as const,
        accessibilityLabel: subtitle ? `${title}, ${subtitle}` : title,
      }
    : {};
  return (
    <Pressable onPress={onPress} {...interactiveProps} style={[styles.row, style]}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </Pressable>
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
  content: { flexShrink: 1 },
  title: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
  subtitle: { color: colors.textMuted, fontSize: typography.size.small },
  right: { marginLeft: 'auto' },
});
