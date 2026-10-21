import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, typography } from './tokens';
import { Text } from './Text';
import { PayrollButton } from './PayrollButton';
import { format12h, isValidRange, stepEnd, stepStart, type TimeRange } from './time-range';

export type TimeRangePopupProps = {
  visible: boolean;
  title: string;
  date: Date;
  initialStart: string;
  initialEnd: string;
  onSave: (start: string, end: string) => void;
  onClose: () => void;
  onCancelVisit?: () => void;
  note?: string;
};

export function TimeRangePopup({
  visible,
  title,
  date,
  initialStart,
  initialEnd,
  onSave,
  onClose,
  onCancelVisit,
  note,
}: TimeRangePopupProps) {
  const [range, setRange] = useState<TimeRange>({ start: initialStart, end: initialEnd });

  useEffect(() => {
    if (visible) setRange({ start: initialStart, end: initialEnd });
  }, [visible, initialStart, initialEnd]);

  const valid = isValidRange(range.start, range.end);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          {note ? <Text style={styles.note}>{note}</Text> : null}

          <View style={styles.row}>
            <Text style={styles.rowLabel}>From</Text>
            <PayrollButton
              label="‹"
              accessibilityLabel="Earlier start"
              testID="time-range-from-prev"
              onPress={() => setRange((r) => stepStart(r, -1))}
            />
            <Text style={styles.time}>{format12h(range.start)}</Text>
            <PayrollButton
              label="›"
              accessibilityLabel="Later start"
              testID="time-range-from-next"
              onPress={() => setRange((r) => stepStart(r, 1))}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>To</Text>
            <PayrollButton
              label="‹"
              accessibilityLabel="Earlier end"
              testID="time-range-to-prev"
              onPress={() => setRange((r) => stepEnd(r, -1))}
            />
            <Text style={styles.time}>{format12h(range.end)}</Text>
            <PayrollButton
              label="›"
              accessibilityLabel="Later end"
              testID="time-range-to-next"
              onPress={() => setRange((r) => stepEnd(r, 1))}
            />
          </View>

          {!valid ? <Text style={styles.error}>End must be after start</Text> : null}

          <View style={styles.footer}>
            <PayrollButton
              label="Save"
              disabled={!valid}
              onPress={() => onSave(range.start, range.end)}
              testID="time-range-save"
            />
            <PayrollButton label="Close" onPress={onClose} testID="time-range-close" />
            {onCancelVisit ? (
              <PayrollButton
                label="Cancel visit"
                tone="danger"
                onPress={onCancelVisit}
                testID="time-range-cancel-visit"
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    width: '80%',
    maxWidth: 320,
    alignSelf: 'center',
    padding: 16,
  },
  title: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.body,
    color: colors.text,
  },
  subtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.label,
    color: colors.textMuted,
    marginTop: 2,
  },
  note: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.label,
    color: colors.textMuted,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    width: 40,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.medium,
    fontSize: typography.size.label,
    color: colors.text,
  },
  time: {
    width: 84,
    textAlign: 'center',
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.body,
    color: colors.text,
  },
  error: {
    marginTop: 8,
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.label,
    color: colors.danger,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
  },
});
