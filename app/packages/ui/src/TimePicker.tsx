/**
 * TimePicker: half-hour chips (6:00 AM to 8:00 PM) plus a minute row.
 * One component for the calendar screen header and the day sheet, so the hour of the day is picked the same way everywhere (Jeff 2026-11-06).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { format } from 'date-fns';
import { Text } from './Text';
import { colors, radius, spacing, typography } from './tokens';

const MINUTES = ['00', '15', '30', '45'];

/** Half-hour slots, 6:00 AM to 8:00 PM. */
export const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = 6 * 60; m <= 20 * 60; m += 30) {
    out.push(format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), 'h:mm a'));
  }
  return out;
})();

/** Replace the minutes of an "h:mm a" string. */
export function withMinute(time: string, mm: string): string {
  return time.replace(/:\d\d/, `:${mm}`);
}

export interface TimePickerProps {
  value: string | null;
  onChange: (time: string | null) => void;
  label?: string;
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  return (
    <View>
      <Text numberOfLines={1} style={styles.label}>
        {value ? `${label ?? 'Start time'}: ${value}` : `${label ?? 'Start time'} (optional)`}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {TIME_SLOTS.map((slot) => (
          <Pressable
            key={slot}
            onPress={() => onChange(value === slot ? null : slot)}
            style={[styles.chip, value === slot ? styles.chipOn : null]}
          >
            <Text numberOfLines={1} style={value === slot ? styles.chipTextOn : styles.chipText}>{slot}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {value ? (
        <View style={styles.minuteRow}>
          <Text style={styles.label}>Minute</Text>
          {MINUTES.map((mm) => (
            <Pressable
              key={mm}
              onPress={() => onChange(withMinute(value, mm))}
              style={[styles.chip, value.includes(`:${mm}`) ? styles.chipOn : null]}
            >
              <Text style={value.includes(`:${mm}`) ? styles.chipTextOn : styles.chipText}>{`:${mm}`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: typography.text.body, color: colors.text },
  chipTextOn: { fontSize: typography.text.body, color: colors.white },
  minuteRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
});
