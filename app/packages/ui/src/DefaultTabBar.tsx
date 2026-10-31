/**
 * DEFAULT JobCore tab bar spec - source: screen #0010 (Payroll) (registry #0010 = Admin & Finance root; Payroll = #88). Anchored directly
 * under the header; active tab = bold text + darkened background + blue underline.
 * Use this for any 'tab bar' / 'tabs along the top' request; never inline a bar.
 * NOTE: the legacy wrapping-pill TabBar.tsx was retired 2026-10-18; this is the only tab bar.
 */
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { colors } from './tokens';

export interface DefaultTabBarProps<T extends string> {
  tabs: Array<{ id: T; label: string }>;
  activeId: T;
  onChange: (id: T) => void;
  rightSlot?: React.ReactNode;
  /** Optional label override, applied after the default (e.g. drop the active bold). */
  labelStyle?: StyleProp<TextStyle>;
}

export function DefaultTabBar<T extends string>({
  tabs,
  activeId,
  onChange,
  rightSlot,
  labelStyle,
}: DefaultTabBarProps<T>) {
  return (
    <View style={styles.row}>
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={[
              styles.tab,
              {
                backgroundColor: selected ? colors.sand : colors.sandInactive,
                borderBottomColor: selected ? colors.selected : 'transparent',
              },
            ]}
          >
            <Text numberOfLines={1} style={[{ color: colors.text, fontSize: 13, fontWeight: selected ? '700' : '400' }, labelStyle]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  tab: { paddingVertical: 1, paddingHorizontal: 9, borderBottomWidth: 2 },
  right: { marginLeft: 'auto' },
});

export default DefaultTabBar;
