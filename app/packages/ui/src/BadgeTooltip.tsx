// BadgeTooltip — press-and-hold on a colored badge or status mark opens a small card that
// names the badge and its current state (Jeff 2026-11-05). Phones have no hover, so the
// long-press is the trigger; "?" stays reserved for help cards. Tap anywhere or Android back closes it.
import React, { useState } from 'react';
import { Modal, Pressable, View, StyleSheet } from 'react-native';
import type { Insets, StyleProp, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing, typography } from './tokens';

export type TooltipCardProps = {
  visible: boolean;
  title: string;
  state: string;
  detail?: string;
  color?: string;
  onClose: () => void;
  testID?: string;
};

export function TooltipCard({ visible, title, state, detail, color, onClose, testID }: TooltipCardProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
        <View style={styles.card} testID={testID ?? 'badge-tooltip'}>
          <View style={styles.head}>
            {color ? <View style={[styles.swatch, { backgroundColor: color }]} /> : null}
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
          <Text style={styles.state}>{state}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
      </Pressable>
    </Modal>
  );
}

export type BadgeTooltipProps = {
  title: string;
  state: string;
  detail?: string;
  color?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | Insets;
  testID?: string;
};

export function BadgeTooltip({ title, state, detail, color, children, style, hitSlop = 8, testID }: BadgeTooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onLongPress={() => setOpen(true)}
        delayLongPress={350}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${state}`}
        accessibilityHint="Press and hold for details"
        style={style}
        testID={testID}
      >
        {children}
      </Pressable>
      <TooltipCard
        visible={open}
        title={title}
        state={state}
        detail={detail}
        color={color}
        onClose={() => setOpen(false)}
        testID={testID ? `${testID}-tooltip` : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignSelf: 'center',
    minWidth: 220,
    maxWidth: 360,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  title: {
    flexShrink: 1,
    fontSize: typography.text.title,
    fontWeight: typography.weight.bold,
    color: colors.text,
    fontFamily: typography.fontFamily.body,
  },
  state: { marginTop: spacing.xs, fontSize: typography.text.body, color: colors.text, fontFamily: typography.fontFamily.body },
  detail: { marginTop: spacing.xs, fontSize: typography.text.hint, color: colors.textMuted, fontFamily: typography.fontFamily.body },
});
