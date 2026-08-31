import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Button } from './Button';
import { spacing, radius } from './tokens';

export interface TabBarItem<T extends string> {
  key: T;
  label: string;
}

export interface TabBarProps<T extends string> {
  items: Array<TabBarItem<T>>;
  activeKey: T;
  onSelect: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}

/** Horizontal row of nav tab buttons. `size` is deliberately not a
 * prop — always hardcoded to 'tab' so no call site can pick the wrong size.
 * Wraps onto additional lines as available width narrows (flexWrap: 'wrap')
 * rather than requiring horizontal scrolling — matches the "regardless of
 * the size of the window" requirement. A plain View has no React Native
 * default flexGrow behavior to guard against (unlike the ScrollView this
 * replaced), so no extra flexGrow/flexShrink pinning is needed here. */
export function TabBar<T extends string>({ items, activeKey, onSelect, style }: TabBarProps<T>) {
  return (
    <View style={[styles.row, style]}>
      {items.map(({ key, label }) => (
        <Button
          key={key}
          label={label}
          variant={activeKey === key ? 'primary' : 'outline'}
          size="tab"
          onPress={() => onSelect(key)}
          style={styles.tab}
        />
      ))}
    </View>
  );
}

export default TabBar;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: spacing.md,
    gap: 10,
  },
  tab: {
    borderRadius: radius.md,
  },
});
