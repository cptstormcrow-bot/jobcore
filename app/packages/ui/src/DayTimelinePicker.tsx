// Day timeline picker - vertical slot list for one day; busy slots are blocked, open slots call onPick. Dumb renderer.
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, typography, spacing, radius } from './tokens';
import { format } from 'date-fns';

export type DayTimelineBusyBlock = { id: string; startMs: number; endMs: number; label?: string };

export type DayTimelinePickerProps = {
  date: Date;
  busy: DayTimelineBusyBlock[];
  selectedStartMs?: number | null;
  onPick: (startMs: number) => void;
  slotMinutes?: number;
  dayStartHour?: number;
  dayEndHour?: number;
  testID?: string;
};

export function DayTimelinePicker({
  date,
  busy,
  selectedStartMs = null,
  onPick,
  slotMinutes = 30,
  dayStartHour = 6,
  dayEndHour = 20,
  testID,
}: DayTimelinePickerProps) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), dayStartHour, 0, 0, 0).getTime();
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), dayEndHour, 0, 0, 0).getTime();
  const step = Math.max(1, slotMinutes) * 60000;

  const slots: number[] = [];
  for (let t = dayStart; t < dayEnd; t += step) slots.push(t);

  return (
    <ScrollView style={styles.root} testID={testID} nestedScrollEnabled>
      {slots.map((slotStart) => {
        const slotEnd = slotStart + step;
        const block = busy.find((b) => b.startMs < slotEnd && b.endMs > slotStart);
        const isBusy = !!block;
        const isFirstOfBlock = !!block && block.startMs < slotEnd && block.startMs >= slotStart
          ? true
          : !!block && slotStart === dayStart;
        const isSelected = selectedStartMs != null && selectedStartMs >= slotStart && selectedStartMs < slotEnd;
        const d = new Date(slotStart);
        const onHour = d.getMinutes() === 0;
        const timeText = format(d, 'h:mm a');
        const a11y = `${isBusy ? 'Busy' : 'Open'} ${timeText}`;
        return (
          <View key={slotStart} style={styles.row}>
            <Text style={styles.hour}>{onHour ? timeText : ''}</Text>
            <Pressable
              disabled={isBusy}
              onPress={() => onPick(slotStart)}
              accessibilityRole={isBusy ? undefined : 'button'}
              accessibilityLabel={a11y}
              accessibilityState={{ disabled: isBusy, selected: isSelected }}
              style={[styles.slot, isBusy && styles.busy, isSelected && styles.selected]}
            >
              {isBusy && isFirstOfBlock && block?.label ? (
                <Text style={styles.busyText} numberOfLines={1} ellipsizeMode="tail">
                  {block.label}
                </Text>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { maxHeight: 240 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  hour: { width: 72, color: colors.textMuted, fontSize: typography.size.small, paddingTop: spacing.xs },
  slot: {
    flex: 1,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.sandInactive,
    marginBottom: 2,
  },
  busy: { backgroundColor: colors.danger, borderColor: 'transparent', opacity: 0.8 },
  busyText: { color: '#FFFFFF', fontSize: typography.size.small },
  selected: { backgroundColor: colors.sand, borderWidth: 2, borderColor: colors.gold },
});
