import React from 'react';
import { Pressable, View, StyleSheet, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import { Text } from './Text';
import { TruncatedText } from './TruncatedText';
import { colors, spacing, typography } from './tokens';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  overline?: string;
  footer?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  center?: React.ReactNode;
  footerLines?: number;
  style?: StyleProp<ViewStyle>;
}

const CENTER_STACK_BREAKPOINT = 480;

export function ListItem({ title, subtitle, overline, footer, onPress, right, center, footerLines, style }: ListItemProps) {
  const { width } = useWindowDimensions();
  // On a pressable row a tap runs onPress; a long press opens the full-title popup instead.
  const [titleOpen, setTitleOpen] = React.useState(false);
  const hasCenter = center !== undefined && center !== null && center !== false;
  const sideBySide = hasCenter && width >= CENTER_STACK_BREAKPOINT;
  const stacked = hasCenter && !sideBySide;
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
      <Pressable
        onPress={onPress}
        onLongPress={onPress ? () => setTitleOpen(true) : undefined}
        {...interactiveProps}
        style={sideBySide ? [styles.main, styles.mainWithCenter] : styles.main}
      >
        <View style={styles.content}>
          {overline ? <TruncatedText style={styles.overline}>{overline}</TruncatedText> : null}
          <TruncatedText style={styles.title} tappable={!onPress} open={titleOpen} onClose={() => setTitleOpen(false)}>{title}</TruncatedText>
          {subtitle ? <TruncatedText style={styles.subtitle}>{subtitle}</TruncatedText> : null}
          {footer ? (
            footerLines !== undefined ? (
              <Text style={styles.footer} numberOfLines={footerLines} ellipsizeMode="tail">
                {footer}
              </Text>
            ) : (
              <Text style={styles.footer}>{footer}</Text>
            )
          ) : null}
          {stacked ? <View style={styles.centerStacked}>{center}</View> : null}
        </View>
      </Pressable>
      {sideBySide ? <View style={styles.centerSide}>{center}</View> : null}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 32,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  main: { flexShrink: 1, flexGrow: 1 },
  mainWithCenter: { flex: 2 },
  centerSide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerStacked: { marginTop: spacing.xs, alignItems: 'flex-start' },
  content: { flexShrink: 1 },
  title: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
  subtitle: { color: colors.textMuted, fontSize: typography.size.small },
  overline: { color: colors.textMuted, fontSize: typography.size.small },
  footer: { color: colors.textMuted, fontSize: typography.size.small },
  right: { marginLeft: 'auto' },
});
