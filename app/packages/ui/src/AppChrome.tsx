import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from './tokens';
import type { BreadcrumbSegment } from './Breadcrumb';

export type MenuItem = {
  id: string;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[]; // one level, used only by the Configuration entry
};

export type AppChromeProps = {
  breadcrumbSegments: BreadcrumbSegment[];
  menuItems: MenuItem[];
  optionsItems?: MenuItem[];
  showBack?: boolean; // default true
  titleBar?: { title: string; subtitle?: string };
};

function MenuRow({
  item,
  depth = 0,
  onLeafPress,
}: {
  item: MenuItem;
  depth?: number;
  onLeafPress: (item: MenuItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubmenu = !!item.submenu && item.submenu.length > 0;

  return (
    <View>
      <Pressable
        onPress={() => {
          if (item.disabled) return;
          if (hasSubmenu) {
            setExpanded((prev) => !prev);
          } else {
            onLeafPress(item);
          }
        }}
        disabled={item.disabled}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ disabled: item.disabled, selected: item.isActive }}
        style={[
          styles.row,
          { paddingLeft: spacing.md + depth * spacing.md },
          item.isActive && styles.rowActive,
          item.disabled && styles.rowDisabled,
        ]}
      >
        <Text
          style={[
            styles.rowText,
            item.isActive && styles.rowTextActive,
            item.disabled && styles.rowTextDisabled,
          ]}
        >
          {item.label}
          {hasSubmenu ? (expanded ? '  ▾' : '  ▸') : ''}
        </Text>
      </Pressable>
      {hasSubmenu && expanded && (
        <View>
          {item.submenu!.map((child) => (
            <MenuRow key={child.id} item={child} depth={depth + 1} onLeafPress={onLeafPress} />
          ))}
        </View>
      )}
    </View>
  );
}

export function AppChrome({
  breadcrumbSegments,
  menuItems,
  optionsItems,
  showBack = true,
  titleBar,
}: AppChromeProps): JSX.Element {
  const router = useRouter();
  const [hMenuOpen, setHMenuOpen] = useState(false);
  const [oMenuOpen, setOMenuOpen] = useState(false);
  const canGoBack = router.canGoBack();

  const handleLeafPress = (item: MenuItem) => {
    setHMenuOpen(false);
    item.onPress();
  };

  const handleOptionPress = (item: MenuItem) => {
    setOMenuOpen(false);
    item.onPress();
  };

  const handleBackPress = () => {
    if (!canGoBack) return;
    setHMenuOpen(false);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => setHMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          hitSlop={8}
          style={styles.iconButton}
        >
          <Text style={styles.iconText}>☰</Text>
        </Pressable>
        {titleBar && (
          <View style={styles.titleBar}>
            <Text style={styles.titleBarTitle} numberOfLines={1}>
              {titleBar.title}
            </Text>
            {titleBar.subtitle ? (
              <Text style={styles.titleBarSubtitle} numberOfLines={1}>
                {titleBar.subtitle}
              </Text>
            ) : null}
          </View>
        )}
        <Pressable
          onPress={() => setOMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Options"
          hitSlop={8}
          style={styles.iconButton}
        >
          <Text style={styles.iconText}>⋮</Text>
        </Pressable>
      </View>

      <Modal visible={hMenuOpen} transparent animationType="fade" onRequestClose={() => setHMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setHMenuOpen(false)}>
          <View style={styles.sheet}>
            <ScrollView style={{ maxHeight: '100%' }}>
              {showBack && (
                <>
                  <Pressable
                    onPress={handleBackPress}
                    disabled={!canGoBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    accessibilityState={{ disabled: !canGoBack }}
                    style={[styles.row, !canGoBack && styles.rowDisabled]}
                  >
                    <Text style={[styles.rowText, !canGoBack && styles.rowTextDisabled]}>‹ Back</Text>
                  </Pressable>
                  <View style={styles.divider} />
                </>
              )}
              {menuItems.map((item) => (
                <MenuRow key={item.id} item={item} onLeafPress={handleLeafPress} />
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={oMenuOpen} transparent animationType="fade" onRequestClose={() => setOMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOMenuOpen(false)}>
          <View style={styles.sheet}>
            <ScrollView style={{ maxHeight: '100%' }}>
              {optionsItems && optionsItems.length > 0 ? (
                optionsItems.map((item) => (
                  <MenuRow key={item.id} item={item} onLeafPress={handleOptionPress} />
                ))
              ) : (
                <View style={styles.row}>
                  <Text style={[styles.rowText, styles.rowTextDisabled]}>No options available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default AppChrome;

const styles = StyleSheet.create({
  container: { width: '100%' },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  iconButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  iconText: {
    fontFamily: typography.fontFamily.heading,
    fontSize: typography.size.h5,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  titleBar: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    alignItems: 'center',
  },
  titleBarTitle: {
    fontFamily: typography.fontFamily.headingBold,
    fontSize: 15,
    color: colors.white,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  titleBarSubtitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: 12,
    color: colors.white,
    opacity: 0.85,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    maxHeight: '60%',
    paddingVertical: spacing.sm,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: spacing.xs,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowActive: {
    backgroundColor: colors.surfaceAlt,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowText: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
  },
  rowTextActive: {
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  rowTextDisabled: {
    color: colors.textMuted,
  },
});
