import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius } from './tokens';

export type CalendarMode = 'week' | 'month';

export interface CalendarHeaderProps {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarHeader({
  mode,
  onModeChange,
  label,
  onPrev,
  onNext,
  onToday,
}: CalendarHeaderProps): JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onPrev}
          style={styles.navButton}
        >
          <Text>‹ Prev</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onToday}
          style={styles.navButton}
        >
          <Text>Today</Text>
        </Pressable>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onNext}
          style={styles.navButton}
        >
          <Text>Next ›</Text>
        </Pressable>
      </View>
      <View style={styles.segmentedControl}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'week' }}
          onPress={() => onModeChange('week')}
          style={[
            styles.segment,
            mode === 'week' ? styles.segmentSelected : styles.segmentUnselected,
          ]}
        >
          <Text
            style={mode === 'week' ? styles.segmentTextSelected : styles.segmentText}
          >
            Week
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'month' }}
          onPress={() => onModeChange('month')}
          style={[
            styles.segment,
            mode === 'month' ? styles.segmentSelected : styles.segmentUnselected,
          ]}
        >
          <Text
            style={mode === 'month' ? styles.segmentTextSelected : styles.segmentText}
          >
            Month
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.text,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
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
  },
  segmentTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
});
