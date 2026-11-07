import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, compact, spacing, typography } from './tokens';

/**
 * Screen title row for the Job timeline screens (Jeff 2026-11-05): the screen title is
 * left-justified and any action buttons (Save, Cancel, Reset ...) sit at the right on
 * the same line. One row, min 32 high.
 */
export type ScreenTitleRowProps = { title: string; center?: React.ReactNode; right?: React.ReactNode; testID?: string };

export function ScreenTitleRow({ title, center, right, testID }: ScreenTitleRowProps) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {center ? <View style={styles.center} pointerEvents="box-none">{center}</View> : null}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: compact.rowMin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.offWhite,
  },
  title: {
    flexShrink: 1,
    color: colors.text,
    fontSize: typography.text.title,
    fontFamily: typography.fontFamily.headingBold,
    textAlign: 'left',
  },
  // Uber 161: centered on the whole row (the screen), not in the leftover space between title and right slot.
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm, flexShrink: 0 },
});
