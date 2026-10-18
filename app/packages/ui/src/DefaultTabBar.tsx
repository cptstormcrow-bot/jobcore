/**
 * DEFAULT JobCore tab bar spec - source: screen #0010 (Payroll). Anchored directly
 * under the header; active tab = bold text + darkened background + blue underline.
 * Use this for any 'tab bar' / 'tabs along the top' request; never inline a bar.
 * NOTE: the legacy wrapping-pill TabBar.tsx was retired 2026-10-18; this is the only tab bar.
 */
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { colors } from './tokens';

export interface DefaultTabBarProps<T extends string> {
  tabs: Array<{ id: T; label: string }>;
  activeId: T;
  onChange: (id: T) => void;
  rightSlot?: React.ReactNode;
}

export function DefaultTabBar<T extends string>({
  tabs,
  activeId,
  onChange,
  rightSlot,
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
                borderBottomColor: selected ? '#2563eb' : 'transparent',
              },
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: selected ? '700' : '400' }}>
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
  tab: { paddingVertical: 4, paddingHorizontal: 12, borderBottomWidth: 2 },
  right: { marginLeft: 'auto' },
});

export default DefaultTabBar;
