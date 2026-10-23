/**
 * SchedulePicker - inline month grid + hour/minute/AM-PM columns with job/blackout markers and a
 * day agenda. Controlled by `value` (draft start ISO). Pure helpers live in ./schedule-picker.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors, radius, spacing, typography } from './tokens';
import { Text } from './Text';
import { PayrollButton } from './PayrollButton';
import {
  applyDayToValue,
  applyTimeToValue,
  buildMonthGrid,
  dateKeyOfDate,
  dateKeyOfIso,
  formatSlotHeading,
  groupItemsByLocalDay,
  isoToLocalParts,
  localPartsToIso,
  monthTitle,
  shiftMonth,
  to12h,
} from './schedule-picker';
import type { SchedulePickerItem } from './schedule-picker';

export type SchedulePickerProps = {
  value: string | null;
  onChange: (iso: string | null) => void;
  items: SchedulePickerItem[];
  showBlackouts: boolean;
  onSelectItem: (item: SchedulePickerItem) => void;
  initialMonthIso?: string | null;
  testIDPrefix?: string;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ROW_H = 32;
const WIDE = 640;

const pad2 = (n: number): string => (n < 10 ? '0' + n : String(n));

function monthOf(iso: string | null | undefined): { year: number; month: number } | null {
  const p = isoToLocalParts(iso ?? null);
  return p ? { year: p.year, month: p.month } : null;
}

function clockOf(iso: string): string {
  const p = isoToLocalParts(iso);
  if (!p) return '';
  const t = to12h(p.hour24);
  return `${t.hour12}:${pad2(p.minute)} ${t.meridiem}`;
}

function timeLabel(item: SchedulePickerItem, focusKey: string): string {
  const endKey = item.endIso ? dateKeyOfIso(item.endIso) : '';
  if (dateKeyOfIso(item.startIso) === focusKey) {
    const start = clockOf(item.startIso);
    return item.endIso && endKey === focusKey ? `${start} - ${clockOf(item.endIso)}` : start;
  }
  if (item.endIso && endKey === focusKey) return `until ${clockOf(item.endIso)}`;
  return 'All day';
}

function TimeColumn(props: {
  title: string;
  values: number[] | string[];
  selected: number | string | null;
  format: (v: number | string) => string;
  onPick: (v: number | string) => void;
  testPrefix: string;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const { title, values, selected, format, onPick, testPrefix, scrollRef } = props;
  const rows = (values as Array<number | string>).map((v) => {
    const isSel = v === selected;
    return (
      <Pressable
        key={String(v)}
        onPress={() => onPick(v)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSel }}
        testID={`${testPrefix}-${v}`}
        style={[styles.timeCell, isSel ? styles.timeCellSelected : null]}
      >
        <Text style={[styles.timeText, isSel ? styles.timeTextSelected : null]}>{format(v)}</Text>
      </Pressable>
    );
  });
  return (
    <View style={styles.timeCol}>
      <Text style={styles.timeHeader}>{title}</Text>
      {scrollRef ? (
        <ScrollView
          ref={scrollRef as never}
          style={styles.timeScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {rows}
        </ScrollView>
      ) : (
        <View>{rows}</View>
      )}
    </View>
  );
}

export function SchedulePicker({
  value,
  onChange,
  items,
  showBlackouts,
  onSelectItem,
  initialMonthIso,
  testIDPrefix,
}: SchedulePickerProps) {
  const p = testIDPrefix ?? 'schedule-picker';
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;

  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return monthOf(initialMonthIso) ?? monthOf(value) ?? { year: now.getFullYear(), month: now.getMonth() };
  });
  const [focusKey, setFocusKey] = useState<string>(() =>
    value ? dateKeyOfIso(value) : dateKeyOfDate(new Date()),
  );

  // Derived-state-during-render: follow an external value change, never on mount.
  const [prevValue, setPrevValue] = useState<string | null>(value);
  if (prevValue !== value) {
    setPrevValue(value);
    if (value) {
      const m = monthOf(value);
      if (m && (m.year !== view.year || m.month !== view.month)) setView(m);
      const k = dateKeyOfIso(value);
      if (k && k !== focusKey) setFocusKey(k);
    }
  }

  const visibleItems = useMemo(
    () => (showBlackouts ? items : items.filter((i) => i.kind !== 'blackout')),
    [items, showBlackouts],
  );
  const byDay = useMemo(() => groupItemsByLocalDay(visibleItems), [visibleItems]);
  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view.year, view.month]);
  const todayKey = dateKeyOfDate(new Date());
  const selectedKey = value ? dateKeyOfIso(value) : null;

  const parts = isoToLocalParts(value);
  const cur = parts ? to12h(parts.hour24) : null;
  const selHour = cur ? cur.hour12 : null;
  const selMinute = parts ? parts.minute : null;
  const selMeridiem = cur ? cur.meridiem : null;

  const hourRef = useRef<ScrollView>(null);
  const minuteRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (selHour === null) return;
    hourRef.current?.scrollTo({ y: Math.max(0, (selHour - 1) * ROW_H - 64), animated: false });
  }, [selHour]);
  useEffect(() => {
    if (selMinute === null) return;
    minuteRef.current?.scrollTo({ y: Math.max(0, selMinute * ROW_H - 64), animated: false });
  }, [selMinute]);

  const setTime = (patch: { hour12?: number; meridiem?: 'AM' | 'PM'; minute?: number }) =>
    onChange(applyTimeToValue(value, patch, new Date()));

  const focusParts = focusKey.split('-').map((s) => parseInt(s, 10));
  const agendaHeading = formatSlotHeading(
    localPartsToIso({
      year: focusParts[0] ?? view.year,
      month: (focusParts[1] ?? 1) - 1,
      day: focusParts[2] ?? 1,
      hour24: 12,
      minute: 0,
    }),
    null,
  ).split(' at ')[0];
  const agendaRows = byDay.get(focusKey) ?? [];

  const monthWord = (m: number) => monthTitle(view.year, m).split(' ')[0];

  return (
    <View style={styles.root} testID={p}>
      <View style={[styles.top, wide ? styles.topWide : null]}>
        <View style={styles.calendar}>
          <View style={styles.header}>
            <PayrollButton
              label="‹"
              accessibilityLabel="Previous month"
              testID={`${p}-prev`}
              onPress={() => setView((v) => shiftMonth(v.year, v.month, -1))}
            />
            <Text style={styles.title}>{monthTitle(view.year, view.month)}</Text>
            <PayrollButton
              label="›"
              accessibilityLabel="Next month"
              testID={`${p}-next`}
              onPress={() => setView((v) => shiftMonth(v.year, v.month, 1))}
            />
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>
          {Array.from({ length: 6 }, (_, r) => (
            <View key={r} style={styles.gridRow}>
              {grid.slice(r * 7, r * 7 + 7).map((cell, c) => {
                const list = byDay.get(cell.dateKey) ?? [];
                const hasBlackout = list.some((i) => i.kind === 'blackout');
                const jobCount = list.filter((i) => i.kind === 'job').length;
                const jobDots = Math.min(jobCount, hasBlackout ? 2 : 3);
                const isSel = selectedKey !== null && cell.dateKey === selectedKey;
                const isToday = cell.dateKey === todayKey;
                const weekend = c === 0 || c === 6;
                let textColor: string = colors.text;
                if (!cell.inMonth) textColor = colors.textMuted;
                else if (weekend) textColor = colors.textLight;
                if (hasBlackout) textColor = colors.danger;
                if (isSel) textColor = colors.white;
                return (
                  <Pressable
                    key={cell.dateKey}
                    onPress={() => {
                      onChange(
                        applyDayToValue(value, { year: cell.year, month: cell.month, day: cell.day }),
                      );
                      setFocusKey(cell.dateKey);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={`${monthWord(cell.month)} ${cell.day}, ${cell.year}`}
                    testID={`${p}-day-${cell.dateKey}`}
                    style={[
                      styles.dayCell,
                      isToday && !isSel ? styles.dayToday : null,
                      isSel ? styles.daySelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: textColor },
                        !cell.inMonth && !isSel ? styles.dim : null,
                        isToday || isSel ? styles.bold : null,
                      ]}
                    >
                      {cell.day}
                    </Text>
                    <View style={styles.dots}>
                      {Array.from({ length: jobDots }, (_, i) => (
                        <View key={`j${i}`} style={[styles.dot, { backgroundColor: colors.primary }]} />
                      ))}
                      {hasBlackout ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={[styles.timeRow, wide ? styles.timeRowWide : null]}>
          <TimeColumn
            title="Hour"
            values={HOURS}
            selected={selHour}
            format={(v) => String(v)}
            onPick={(v) => setTime({ hour12: v as number })}
            testPrefix={`${p}-hour`}
            scrollRef={hourRef}
          />
          <TimeColumn
            title="Min"
            values={MINUTES}
            selected={selMinute}
            format={(v) => pad2(v as number)}
            onPick={(v) => setTime({ minute: v as number })}
            testPrefix={`${p}-minute`}
            scrollRef={minuteRef}
          />
          <TimeColumn
            title="AM/PM"
            values={['AM', 'PM']}
            selected={selMeridiem}
            format={(v) => String(v)}
            onPick={(v) => setTime({ meridiem: v as 'AM' | 'PM' })}
            testPrefix={`${p}-meridiem`}
          />
        </View>
      </View>

      <View style={styles.agenda}>
        <Text style={styles.agendaHeading}>{agendaHeading}</Text>
        {agendaRows.length === 0 ? <Text style={styles.muted}>Nothing scheduled this day.</Text> : null}
        {agendaRows.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onSelectItem(item)}
            testID={`${p}-agenda-${item.id}`}
            accessibilityRole="button"
            style={styles.agendaRow}
          >
            <View
              style={[
                styles.marker,
                { backgroundColor: item.kind === 'blackout' ? colors.danger : colors.primary },
              ]}
            />
            <View style={styles.agendaBody}>
              <Text style={styles.agendaTitle}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.muted}>{item.subtitle}</Text> : null}
            </View>
            {item.isCurrent ? <Text style={styles.tag}>This job</Text> : null}
            <Text style={styles.agendaTime}>{timeLabel(item, focusKey)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  top: { gap: spacing.md },
  topWide: { flexDirection: 'row', alignItems: 'flex-start' },
  calendar: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
    color: colors.text,
  },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  gridRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  dayToday: { borderWidth: 1, borderColor: colors.info },
  daySelected: { backgroundColor: colors.info, borderWidth: 2, borderColor: colors.primary },
  dayText: { fontFamily: typography.fontFamily.body, fontSize: typography.size.label },
  dim: { opacity: 0.45 },
  bold: { fontWeight: typography.weight.bold },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 2, height: 6 },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeRowWide: { width: 200 },
  timeCol: { flex: 1 },
  timeHeader: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.detail,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  timeScroll: { height: ROW_H * 6 },
  timeCell: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  timeCellSelected: { borderBottomColor: colors.info },
  timeText: { fontFamily: typography.fontFamily.body, fontSize: typography.size.label, color: colors.text },
  timeTextSelected: { color: colors.info, fontWeight: typography.weight.bold },
  agenda: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  agendaHeading: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.label,
    color: colors.text,
  },
  muted: { fontFamily: typography.fontFamily.body, fontSize: typography.size.small, color: colors.textMuted },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  marker: { width: 8, height: 8, borderRadius: radius.pill },
  agendaBody: { flex: 1 },
  agendaTitle: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.label,
    color: colors.text,
  },
  agendaTime: {
    textAlign: 'right',
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  tag: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.detail,
    color: colors.info,
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
});
