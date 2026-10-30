import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from './tokens';

export type CalendarMode = 'week' | 'month' | 'day';

export interface CalendarHeaderProps {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  labelPosition?: 'above' | 'below';
}

const MODES: { key: CalendarMode; title: string }[] = [
  { key: 'week', title: 'Week' },
  { key: 'month', title: 'Month' },
  { key: 'day', title: 'Day' },
];

// One compact row: Week | Month | Day tabs, then Prev / Today / Next in the
// same sand style as every other button (Rule G1, Button variant="primary"). The period
// label sits on a thin line underneath so Month fits a small phone.
export function CalendarHeader({
  mode,
  onModeChange,
  label,
  onPrev,
  onNext,
  onToday,
  labelPosition = 'below',
}: CalendarHeaderProps): JSX.Element {
  const labelNode = (
    <Text style={styles.label} numberOfLines={1}>
      {label}
    </Text>
  );
  return (
    <View style={styles.container}>
      {labelPosition === 'above' ? labelNode : null}
      <View style={styles.row}>
        <View style={styles.segmentedControl}>
          {MODES.map((m) => {
            const selected = mode === m.key;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => onModeChange(m.key)}
                style={[
                  styles.segment,
                  selected ? styles.segmentSelected : styles.segmentUnselected,
                ]}
              >
                <Text style={selected ? styles.segmentTextSelected : styles.segmentText}>
                  {m.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.navGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous"
            hitSlop={6}
            onPress={onPrev}
            style={styles.navButton}
          >
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            onPress={onToday}
            style={styles.navButton}
          >
            <Text style={styles.navText}>Today</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next"
            hitSlop={6}
            onPress={onNext}
            style={styles.navButton}
          >
            <Text style={styles.navText}>›</Text>
          </Pressable>
        </View>
      </View>
      {labelPosition === 'below' ? labelNode : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  segmentedControl: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
  segmentUnselected: {
    backgroundColor: 'transparent',
  },
  segmentText: {
    color: colors.text,
    fontSize: 13,
  },
  segmentTextSelected: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  navGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  navButton: {
    backgroundColor: colors.sand,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  label: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 13,
    color: colors.text,
  },
});
