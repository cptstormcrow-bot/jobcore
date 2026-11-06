import React from 'react';
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Text } from './Text';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import type { Job } from '@jobcore/core';
import type { TimeOffEvent } from './WeekView';
import { colors, spacing } from './tokens';
import { JOB_STATUS_COLORS, JOB_STATUS_GLYPHS } from './job-status-colors';

export interface MonthViewProps {
  jobs: Job[];
  anchorDay: Date;
  timeOffEvents?: TimeOffEvent[];
  onSelectDay?: (day: Date) => void;
  onSelectJob?: (job: Job) => void;
  onSelectTimeOff?: (event: TimeOffEvent) => void;
  /**
   * dots: day number + status dots (field-tech Overview look).
   * list: window-filling cells with job rows.
   * tiles: unified calendar look (Jeff 2026-11-06): colour-only rounded squares. Red = time off,
   * green + count badge = jobs assigned to the viewer, blue = selected day / other jobs.
   */
  variant?: 'dots' | 'list' | 'tiles';
  /** tiles only: jobs whose assignedTechId matches count green; unset means every job counts green. */
  highlightTechId?: string;
  maxVisibleItems?: number;
  /** ISO day keys (yyyy-MM-dd) highlighted as picked, used by blackout day-picking mode. */
  selectedDays?: string[];
  /** When set, a day tap calls this with the ISO day key instead of onSelectDay. */
  onDayPress?: (isoDay: string) => void;
}

/** Cell width (dp) under which list cells drop the address for a short time chip. 600dp wide / 7 is about 86. */
const COMPACT_CELL_WIDTH = 80;

/** Pale blue for days that hold only other people's jobs. */
const TILE_OTHER_BG = '#DCEBFA';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MonthView({
  jobs,
  anchorDay,
  timeOffEvents = [],
  onSelectDay,
  onSelectJob,
  onSelectTimeOff,
  variant = 'dots',
  highlightTechId,
  maxVisibleItems,
  selectedDays,
  onDayPress,
}: MonthViewProps) {
  // Cell width drives the phone/tablet look (uber 85): a 7-column grid on a phone gives ~50dp cells, too narrow for an
  // address, so below COMPACT_CELL_WIDTH a list cell shows a status-coloured time chip instead and fewer entries.
  const [gridWidth, setGridWidth] = React.useState(0);
  // Tiles size from the window: ~square on phones, capped so tablets don't get giant blocks.
  const { width: winW } = useWindowDimensions();
  const tileH = Math.max(40, Math.min(64, Math.round(Math.min(winW, 900) / 7) - 6));
  const tileFont = tileH >= 56 ? 17 : 14;
  const onGridLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setGridWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
  };
  const compact = gridWidth > 0 && gridWidth / 7 < COMPACT_CELL_WIDTH;
  const visibleLimit = maxVisibleItems ?? (compact ? 3 : 4);
  const gridStart = startOfWeek(startOfMonth(anchorDay), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(anchorDay), { weekStartsOn: 0 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const rows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }

  const listMode = variant === 'list';
  const pickedSet = new Set(selectedDays ?? []);

  type TimeOffEventWithRange = TimeOffEvent & { startDate?: string | number | Date; endDate?: string | number | Date };

  // A bare 'yyyy-MM-dd' is read as local midnight; new Date() would read it as UTC and land a day early west of UTC.
  const toDay = (v: string | number | Date): Date =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : startOfDay(new Date(v));

  const pressDay = (day: Date) => {
    if (onDayPress) {
      onDayPress(format(day, 'yyyy-MM-dd'));
    } else {
      onSelectDay?.(day);
    }
  };

  const grid = (
    <View style={listMode ? styles.gridFill : undefined} onLayout={onGridLayout}>
      <View style={styles.header}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={[styles.dayText, styles.dayTextMuted, variant === 'tiles' && { textAlign: 'center' }, { width: `${100 / 7}%` }]}>
            {label}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row[0]!.toISOString()} style={[styles.row, listMode && styles.rowFill]}>
          {row.map((day) => {
            const dayJobs = jobs.filter((j) => j.scheduledStart && isSameDay(new Date(j.scheduledStart), day));
            const dayStart = startOfDay(day);
            const hasTimeOff = timeOffEvents.some((t) => {
              const start = toDay((t as TimeOffEventWithRange).startDate ?? t.eventTime);
              const end = toDay((t as TimeOffEventWithRange).endDate ?? t.eventTime);
              return isWithinInterval(dayStart, { start, end });
            });
            const inMonth = isSameMonth(day, anchorDay);
            const selected = isSameDay(day, anchorDay);
            const today = isToday(day);
            const picked = pickedSet.has(format(day, 'yyyy-MM-dd'));

            if (listMode) {
              const dayTimeOffList = timeOffEvents.filter((t) => {
                const start = toDay((t as TimeOffEventWithRange).startDate ?? t.eventTime);
                const end = toDay((t as TimeOffEventWithRange).endDate ?? t.eventTime);
                return isWithinInterval(dayStart, { start, end });
              });
              const dayJobsList = jobs
                .filter((j) => j.scheduledStart && isSameDay(new Date(j.scheduledStart), day))
                .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
              const allItems = [...dayTimeOffList, ...dayJobsList];
              const visibleItems = allItems.slice(0, visibleLimit);
              const overflowCount = allItems.length - visibleItems.length;

              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => pressDay(day)}
                  style={[
                    styles.cell,
                    styles.cellList,
                    selected && styles.cellSelected,
                    picked && styles.cellPicked,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !inMonth && styles.dayTextMuted,
                      today && styles.dayTextToday,
                      picked && styles.dayTextPicked,
                      dayTimeOffList.length > 0 && styles.dayTextTimeOff,
                      selected && !picked && styles.dayTextSelected, // last, so a selected day is always white on the dark cell (Jeff 2026-11-05)
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  {visibleItems.map((item) =>
                    'scheduledStart' in item ? (
                      <Pressable key={item.id} onPress={() => onSelectJob?.(item)} style={styles.listItemRow}>
                        <View
                          style={[
                            styles.listItemDot,
                            { backgroundColor: JOB_STATUS_COLORS[item.status] ?? colors.primary },
                          ]}
                        />
                        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.listItemText, selected && !picked && styles.dayTextSelected]}>
                          {compact
                            ? format(new Date(item.scheduledStart!), 'h:mma').toLowerCase().replace(':00', '')
                            : (JOB_STATUS_GLYPHS[item.status] ?? '•') + ' ' + (item.address ?? 'No address')}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable key={item.id} onPress={() => onSelectTimeOff?.(item)}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.listItemText, styles.timeOffListText, selected && !picked && styles.dayTextSelected]}>
                          {compact ? '• Off' : '• ' + (item.title ?? 'Time off')}
                        </Text>
                      </Pressable>
                    )
                  )}
                  {overflowCount > 0 && <Text style={[styles.moreText, selected && !picked && styles.dayTextSelected]}>+{overflowCount} more</Text>}
                </Pressable>
              );
            }

            if (variant === 'tiles') {
              const mine = highlightTechId ? dayJobs.filter((j) => j.assignedTechId === highlightTechId) : dayJobs;
              const others = dayJobs.length - mine.length;
              const bg = picked
                ? colors.sand
                : selected
                  ? colors.info
                  : hasTimeOff
                    ? colors.danger
                    : mine.length > 0
                      ? colors.success
                      : others > 0
                        ? TILE_OTHER_BG
                        : colors.white;
              const onColor = !picked && (selected || hasTimeOff || mine.length > 0);
              const badgeCount = mine.length > 0 ? mine.length : 0;
              return (
                <View key={day.toISOString()} style={styles.tileSlot}>
                  <Pressable
                    onPress={() => pressDay(day)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      format(day, 'EEEE, MMMM d') +
                      (hasTimeOff ? ', time off' : '') +
                      (mine.length ? `, ${mine.length} job${mine.length === 1 ? '' : 's'}` : '')
                    }
                    style={[
                      styles.tile,
                      { backgroundColor: bg, height: tileH },
                      !inMonth && styles.tileFaded,
                      today && styles.tileToday,
                      selected && hasTimeOff && styles.tileSelectedOff,
                    ]}
                  >
                    <Text style={[styles.tileText, { fontSize: tileFont }, onColor && styles.tileTextOn, today && styles.tileTextToday]}>
                      {format(day, 'd')}
                    </Text>
                    {badgeCount > 0 && (
                      <View style={styles.tileBadge}>
                        <Text style={styles.tileBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            }

            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => pressDay(day)}
                style={[styles.cell, selected && styles.cellSelected, picked && styles.cellPicked]}
              >
                <Text
                  style={[
                    styles.dayText,
                    !inMonth && styles.dayTextMuted,
                    today && styles.dayTextToday,
                    picked && styles.dayTextPicked,
                    hasTimeOff && styles.dayTextTimeOff,
                    selected && !picked && styles.dayTextSelected,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                <View style={styles.dotsRow}>
                  {dayJobs.slice(0, 3).map((job) => (
                    <View
                      key={job.id}
                      style={[styles.dot, { backgroundColor: JOB_STATUS_COLORS[job.status] ?? colors.primary }]}
                    />
                  ))}
                  {dayJobs.length > 3 && <Text style={[styles.moreText, selected && !picked && styles.dayTextSelected]}>+{dayJobs.length - 3}</Text>}
                </View>
                {hasTimeOff && <View style={styles.timeOffBar} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );

  if (listMode) {
    return (
      <View style={styles.verticalRoot}>
        <ScrollView style={styles.verticalRoot} contentContainerStyle={styles.scrollFill}>{grid}</ScrollView>
      </View>
    );
  }

  return grid;
}

const styles = StyleSheet.create({
  // Flat calendar squares (Jeff 2026-11-06): no padding, radius or shadow; only a thin
  // gray line (right and bottom edge of each square) separates the days.
  tileSlot: {
    width: `${100 / 7}%`,
  },
  tile: {
    height: 46,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFaded: { opacity: 0.4 },
  tileToday: {},
  tileSelectedOff: {},
  tileText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tileTextOn: { color: colors.white },
  tileTextToday: { fontWeight: '900', textDecorationLine: 'underline' },
  tileBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBadgeText: { fontSize: 10, fontWeight: '800', color: colors.success },
  header: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: `${100 / 7}%`,
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    padding: 0,
  },
  cellSelected: {
    backgroundColor: colors.primary,
  },
  cellPicked: {
    backgroundColor: colors.sand,
  },
  dayText: {
    fontSize: 12,
    color: colors.text,
  },
  dayTextMuted: {
    color: colors.textMuted,
  },
  dayTextToday: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  dayTextSelected: {
    color: colors.white,
  },
  dayTextPicked: {
    color: colors.text,
    fontWeight: '700',
  },
  dayTextTimeOff: {
    color: colors.danger,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: 2,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  moreText: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 2,
  },
  timeOffBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.danger,
  },
  verticalRoot: {
    flex: 1,
  },
  cellList: {
    minHeight: 80,
    padding: 2,
  },
  // List mode stretches the month to the window: the grid fills the scroll area and each week row shares the height.
  scrollFill: {
    flexGrow: 1,
  },
  gridFill: {
    flex: 1,
  },
  rowFill: {
    flex: 1,
    minHeight: 80,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  listItemDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 2,
  },
  listItemText: {
    fontSize: 11,
    color: colors.text,
    flexShrink: 1,
  },
  timeOffListText: {
    color: colors.danger,
  },
});
