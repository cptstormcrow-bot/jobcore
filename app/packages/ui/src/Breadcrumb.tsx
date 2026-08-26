import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from './tokens';

export interface BreadcrumbSegment {
  label: string;
  onPress?: () => void;
}

export interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

/** Row of tappable path segments separated by '›'. The last segment is always
 * rendered as plain (non-pressable) text — it represents the current screen. */
export function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <View style={styles.row}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <View key={`${segment.label}-${index}`} style={styles.segmentGroup}>
            {isLast || !segment.onPress ? (
              <Text style={[styles.text, isLast && styles.current]}>{segment.label}</Text>
            ) : (
              <Pressable
                onPress={segment.onPress}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={segment.label}
              >
                <Text style={[styles.text, styles.link]}>{segment.label}</Text>
              </Pressable>
            )}
            {!isLast && <Text style={styles.separator}>›</Text>}
          </View>
        );
      })}
    </View>
  );
}

export default Breadcrumb;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  segmentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
  },
  link: {
    color: colors.primary,
  },
  current: {
    color: colors.text,
  },
  separator: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
});
