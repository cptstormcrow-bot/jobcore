/**
 * TimePicker: three scrolling columns (Hour, Min, AM/PM) with a blue highlight on the picked row.
 * Brings back the look of the earlier SchedulePicker time columns (Jeff 2026-11-06: "the scrolling time with the
 * blue highlight was much neater"). Same props as the old chip picker, so the calendar header, the day sheet and
 * the Job schedule screen all pick the time the same way. Value is an "h:mm a" string, or null when no time is set.
 */
import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { format } from 'date-fns';
import { Text } from './Text';
import { colors, spacing, typography } from './tokens';

const ROW_H = 32;
/** Start times run 7:00 AM to 6:00 PM (Jeff 2026-11-06). */
const HOURS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
const MINUTES = ['00', '15', '30', '45'];
const MERIDIEMS = ['AM', 'PM'];

/** AM can only be 7 to 11; PM can only be 12 and 1 to 6. */
function meridiemFor(hour: number): string {
  return hour >= 7 && hour <= 11 ? 'AM' : 'PM';
}

/** Snap a picked time into the 7:00 AM to 6:00 PM window. */
function snap(p: Parts): Parts {
  let { hour, meridiem } = p;
  if (!HOURS.includes(hour)) hour = meridiem === 'AM' ? 7 : 12;
  if (meridiemFor(hour) !== meridiem) {
    // The AM/PM tap wins when it can: AM keeps an AM hour, else lands on 11; PM lands on 12.
    if (meridiem === 'AM') hour = 11;
    else if (meridiem === 'PM') hour = hour >= 7 && hour <= 11 ? 12 : hour;
  }
  const minute = hour === 6 && meridiemFor(hour) === 'PM' ? '00' : p.minute;
  return { hour, minute, meridiem: meridiemFor(hour) };
}

/** Half-hour slots, 7:00 AM to 6:00 PM. Kept for callers that list slots. */
export const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let m = 7 * 60; m <= 18 * 60; m += 30) {
    out.push(format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), 'h:mm a'));
  }
  return out;
})();

/** Replace the minutes of an "h:mm a" string. */
export function withMinute(time: string, mm: string): string {
  return time.replace(/:\d\d/, `:${mm}`);
}

interface Parts {
  hour: number;
  minute: string;
  meridiem: string;
}

function parse(value: string | null): Parts | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d\d)\s*(AM|PM)$/i.exec(value.trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: m[2] as string, meridiem: (m[3] as string).toUpperCase() };
}

function join(p: Parts): string {
  return `${p.hour}:${p.minute} ${p.meridiem}`;
}

export interface TimePickerProps {
  value: string | null;
  onChange: (time: string | null) => void;
  label?: string;
}

function Column(props: {
  title: string;
  values: Array<number | string>;
  selected: number | string | null;
  onPick: (v: number | string) => void;
  testPrefix: string;
  scroll?: boolean;
}) {
  const { title, values, selected, onPick, testPrefix, scroll } = props;
  const ref = useRef<ScrollView>(null);
  const idx = selected === null ? -1 : values.indexOf(selected);
  useEffect(() => {
    if (!scroll || idx < 0) return;
    ref.current?.scrollTo({ y: Math.max(0, idx * ROW_H - ROW_H), animated: false });
  }, [idx, scroll]);
  const rows = values.map((v) => {
    const on = v === selected;
    return (
      <Pressable
        key={String(v)}
        onPress={() => onPick(v)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        testID={`${testPrefix}-${v}`}
        style={[styles.cell, on ? styles.cellOn : null]}
      >
        <Text numberOfLines={1} style={on ? styles.textOn : styles.text}>{String(v)}</Text>
      </Pressable>
    );
  });
  return (
    <View style={styles.col}>
      <Text numberOfLines={1} style={styles.header}>{title}</Text>
      {scroll ? (
        <ScrollView ref={ref} style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator>
          {rows}
        </ScrollView>
      ) : (
        <View style={styles.scroll}>{rows}</View>
      )}
    </View>
  );
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const parts = parse(value);
  const set = (patch: Partial<Parts>) => {
    const base: Parts = parts ?? { hour: 9, minute: '00', meridiem: 'AM' };
    onChange(join(snap({ ...base, ...patch })));
  };
  const title = label ?? 'Start time';
  return (
    <View>
      <View style={styles.labelRow}>
        <Text numberOfLines={1} style={styles.label}>{value ? `${title}: ${value}` : `${title} (optional)`}</Text>
        {value ? (
          <Pressable onPress={() => onChange(null)} accessibilityRole="button" hitSlop={6} testID="time-picker-clear">
            <Text numberOfLines={1} style={styles.clear}>No time</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.row}>
        <Column
          title="Hour"
          values={HOURS}
          selected={parts ? parts.hour : null}
          onPick={(v) => set({ hour: v as number })}
          testPrefix="time-hour"
          scroll
        />
        <Column
          title="Min"
          values={MINUTES}
          selected={parts ? parts.minute : null}
          onPick={(v) => set({ minute: v as string })}
          testPrefix="time-minute"
        />
        <Column
          title="AM/PM"
          values={MERIDIEMS}
          selected={parts ? parts.meridiem : null}
          onPick={(v) => set({ meridiem: v as string })}
          testPrefix="time-meridiem"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { flexShrink: 1, fontSize: 12, color: colors.textMuted },
  clear: { fontSize: 12, color: colors.info, fontWeight: typography.weight.bold },
  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  header: { textAlign: 'center', fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
  scroll: { height: ROW_H * 4 },
  cell: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  cellOn: { borderBottomColor: colors.info },
  text: { fontSize: typography.text.body, color: colors.text },
  textOn: { fontSize: typography.text.body, color: colors.info, fontWeight: typography.weight.bold },
});
