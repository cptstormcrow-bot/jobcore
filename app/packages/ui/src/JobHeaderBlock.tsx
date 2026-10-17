// JobHeaderBlock - a row with the plain-text "Job #N - <created date>" line (no "Created:" label)
// on the left and the schedule label right-justified, plus a children slot (stage rail) beneath.
// Name / address / phone live in the title bar (see JobTitleBarHeader), not here. Plain
// react-native primitives only.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing, typography } from './tokens';
import { formatJobNumberLine, formatScheduledLabel } from './job-header-format';

export type JobHeaderBlockProps = {
  jobNumber: number | string | null | undefined;
  createdAt: string | Date | null | undefined;
  scheduledStart: string | Date | null | undefined;
  children?: React.ReactNode;
  /** When true, the Job #/date row is not rendered and no vertical space is added. */
  hideJobLine?: boolean;
};

export function JobHeaderBlock({
  jobNumber,
  createdAt,
  scheduledStart,
  children,
  hideJobLine = false,
}: JobHeaderBlockProps) {
  return (
    <View style={hideJobLine ? styles.rootCompact : styles.root}>
      {hideJobLine ? null : (
        <View style={styles.row}>
          <Text style={styles.body}>{formatJobNumberLine(jobNumber, createdAt)}</Text>
          <Text style={[styles.body, styles.right]}>
            {formatScheduledLabel(scheduledStart, false)}
          </Text>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.md, marginTop: spacing.xs },
  rootCompact: { paddingHorizontal: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  body: { flexShrink: 1, fontSize: typography.size.body, color: colors.text },
  right: { textAlign: 'right' },
});
