import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from './tokens';
import type { BreadcrumbSegment } from './Breadcrumb';
import type { JobStatus } from '@jobcore/core';
import { getHelpStep, type ScreenKey } from './walkthrough/walkthrough-content';
import { useWalkthrough } from './walkthrough/WalkthroughProvider';
import { WalkthroughHelpCallout } from './walkthrough/WalkthroughHelpCallout';

export type MenuActionItem = {
  id: string;
  label: string;
  kind?: 'action';
  onPress?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[];
};
export type MenuToggleItem = {
  id: string;
  label: string;
  kind: 'toggle';
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  isActive?: boolean;
  submenu?: undefined;
};
export type MenuItem = MenuActionItem | MenuToggleItem;

export type AppChromeProps = {
  breadcrumbSegments: BreadcrumbSegment[];
  menuItems: MenuItem[];
  optionsItems?: MenuItem[];
  showBack?: boolean; // default true
  titleBar?: { title: string; subtitle?: string };
  titleBarTone?: 'primary' | 'gold';
  helpContext?: { screenKey: ScreenKey; jobStatus?: JobStatus };
  gearItems?: MenuActionItem[]; // items for a \u2699 menu at the top-right of the drawer header (opt-in)
  gearTitle?: string; // optional highlighted title row at the top of the gear menu
  compactMenu?: boolean; // tighter drawer rows (opt-in)
  fitMenu?: boolean; // admin-only taller drawer sheet (opt-in)
  logoMenuItems?: MenuActionItem[]; // in-menu logo switcher list (opt-in)
  onLogoPress?: () => void; // logo acts as Back (opt-in)
};

function MenuRow({
  item,
  depth = 0,
  onLeafPress,
  compact,
}: {
  item: MenuItem;
  depth?: number;
  onLeafPress: (item: MenuItem) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubmenu = !!item.submenu && item.submenu.length > 0;
  const pressAnim = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number) => {
    Animated.timing(pressAnim, { toValue, duration: 175, useNativeDriver: false }).start();
  };

  const animatedBg = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [item.isActive ? colors.accent : 'transparent', colors.accent],
  });

  return (
    <View>
      <Pressable
        onPress={() => {
          if (item.disabled) return;
          if (item.kind === 'toggle') { item.onToggle(!item.checked); return; }
          if (hasSubmenu) {
            setExpanded((prev) => !prev);
          } else {
            onLeafPress(item);
          }
        }}
        onPressIn={() => {
          if (item.disabled) return;
          animateTo(1);
        }}
        onPressOut={() => {
          if (item.disabled) return;
          if (!item.isActive) animateTo(0);
        }}
        disabled={item.disabled}
        accessibilityRole={item.kind === 'toggle' ? 'switch' : 'button'}
        accessibilityLabel={item.label}
        accessibilityState={{ disabled: item.disabled, selected: item.isActive, checked: item.kind === 'toggle' ? item.checked : undefined }}
      >
        <Animated.View
          style={[
            styles.row,
            { paddingLeft: spacing.md + depth * spacing.md },
            item.isActive && styles.rowActive,
            item.disabled && styles.rowDisabled,
            { backgroundColor: animatedBg },
            compact && styles.rowCompact,
          ]}
        >
          <Text
            style={[
              styles.rowText,
              item.isActive && styles.rowTextActive,
              item.disabled && styles.rowTextDisabled,
            ]}
          >
            {item.kind === 'toggle' ? (item.checked ? '☑  ' : '☐  ') : ''}{item.label}
            {hasSubmenu ? (expanded ? '  ▾' : '  ▸') : ''}
          </Text>
        </Animated.View>
      </Pressable>
      {hasSubmenu && expanded && (
        <View>
          {item.submenu!.map((child) => (
            <MenuRow key={child.id} item={child} depth={depth + 1} onLeafPress={onLeafPress} compact={compact} />
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
  titleBarTone = 'primary',
  helpContext,
  gearItems,
  gearTitle,
  compactMenu,
  fitMenu,
  logoMenuItems,
  onLogoPress,
}: AppChromeProps): JSX.Element {
  const router = useRouter();
  const [hMenuOpen, setHMenuOpen] = useState(false);
  const [oMenuOpen, setOMenuOpen] = useState(false);
  const [gMenuOpen, setGMenuOpen] = useState(false);
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const logoTappable = !!logoMenuItems?.length || !!onLogoPress;
  const handleLogoPress = () => {
    if (logoMenuItems?.length) {
      setLogoMenuOpen((v) => !v);
    } else {
      setHMenuOpen(false);
      onLogoPress?.();
    }
  };
  const drawerItems: MenuItem[] = logoMenuOpen && logoMenuItems?.length ? logoMenuItems : menuItems;
  useEffect(() => {
    if (!hMenuOpen) setLogoMenuOpen(false);
  }, [hMenuOpen]);
  const canGoBack = router.canGoBack();
  const { standaloneStep, showHelp, dismissHelp } = useWalkthrough();
  const helpStep = helpContext ? getHelpStep(helpContext.screenKey, helpContext.jobStatus) : undefined;
  const resolvedOptionsItems = helpStep
    ? [{ id: 'help', label: 'Help', onPress: () => showHelp(helpStep.id) }, ...(optionsItems ?? [])]
    : optionsItems;

  const handleLeafPress = (item: MenuItem) => {
    setHMenuOpen(false);
    if (item.kind !== 'toggle') item.onPress?.();
  };

  const handleOptionPress = (item: MenuItem) => {
    setOMenuOpen(false);
    if (item.kind !== 'toggle') item.onPress?.();
  };

  const handleGearPress = (item: MenuActionItem) => {
    setHMenuOpen(false);
    setGMenuOpen(false);
    item.onPress?.();
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
          <View style={[styles.titleBar, titleBarTone === 'gold' && styles.titleBarGold]}>
            <Text
              style={[styles.titleBarTitle, titleBarTone === 'gold' && styles.titleBarTextGold]}
              numberOfLines={1}
            >
              {titleBar.title}
            </Text>
            {titleBar.subtitle ? (
              <Text
                style={[styles.titleBarSubtitle, titleBarTone === 'gold' && styles.titleBarTextGold]}
                numberOfLines={1}
              >
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
          <View style={[styles.sheet, fitMenu && styles.sheetFit]}>
            <ScrollView style={{ maxHeight: '100%' }}>
              <View style={styles.wordmarkRow}>
                <Pressable disabled={!logoTappable} onPress={handleLogoPress} accessibilityRole={logoTappable ? 'button' : undefined}>
                <View style={styles.wordmarkChip}>
                  <Text style={styles.wordmarkText}>JobCore©</Text>
                </View>
                </Pressable>
                {gearItems?.length ? (
                  <Pressable
                    onPress={() => { setHMenuOpen(false); setTimeout(() => setGMenuOpen(true), 300); }}
                    accessibilityRole="button"
                    accessibilityLabel="Settings menu"
                    hitSlop={8}
                    style={styles.gearButton}
                  >
                    <Text style={styles.iconText}>{'\u2699\uFE0E'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.divider} />
              {showBack && (
                <>
                  <Pressable
                    onPress={handleBackPress}
                    disabled={!canGoBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    accessibilityState={{ disabled: !canGoBack }}
                    style={[styles.row, !canGoBack && styles.rowDisabled, compactMenu && styles.rowCompact]}
                  >
                    <Text style={[styles.rowText, !canGoBack && styles.rowTextDisabled]}>‹ Back</Text>
                  </Pressable>
                  <View style={styles.divider} />
                </>
              )}
              {drawerItems.map((item) => (
                <MenuRow key={item.id} item={item} onLeafPress={handleLeafPress} compact={compactMenu} />
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={oMenuOpen} transparent animationType="fade" onRequestClose={() => setOMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOMenuOpen(false)}>
          <View style={styles.sheet}>
            <ScrollView style={{ maxHeight: '100%' }}>
              {resolvedOptionsItems && resolvedOptionsItems.length > 0 ? (
                resolvedOptionsItems.map((item) => (
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

      {gearItems?.length ? (
        <Modal visible={gMenuOpen} transparent animationType="fade" onRequestClose={() => setGMenuOpen(false)}>
          <Pressable style={styles.overlay} onPress={() => setGMenuOpen(false)}>
            <View style={[styles.sheet, styles.sheetFramed]}>
              <ScrollView style={{ maxHeight: '100%' }}>
                {gearTitle ? (
                  <>
                    <View style={styles.wordmarkRow}>
                      <View style={styles.wordmarkChip}>
                        <Text style={styles.wordmarkText}>{gearTitle}</Text>
                      </View>
                    </View>
                    <View style={styles.divider} />
                  </>
                ) : null}
                {gearItems.map((item, i) => (
                  <View key={item.id}>
                    {i > 0 ? <View style={styles.gearSeparator} /> : null}
                    <MenuRow item={item} onLeafPress={(g) => handleGearPress(g as MenuActionItem)} compact={compactMenu} />
                  </View>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      ) : null}

      <WalkthroughHelpCallout />
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
  titleBarGold: {
    backgroundColor: colors.gold,
  },
  titleBarTextGold: {
    color: colors.text,
    opacity: 1,
    textShadowColor: 'transparent',
    textShadowRadius: 0,
  },
  wordmarkRow: {
    position: 'relative',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkChip: {
    alignSelf: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  wordmarkText: {
    fontFamily: typography.fontFamily.headingBold,
    color: colors.primary,
    fontSize: typography.size.h6,
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
    maxWidth: 340,
    width: '100%',
    alignSelf: 'center',
  },
  sheetFramed: {
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  gearSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: spacing.xs,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowCompact: {
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  sheetFit: { maxHeight: '90%' },
  gearTitle: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  rowActive: {
    backgroundColor: colors.accent,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowText: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 18,
    textAlign: 'center',
    color: colors.text,
  },
  rowTextActive: {
    fontFamily: typography.fontFamily.headingBold,
    color: colors.white,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  rowTextDisabled: {
    color: colors.textMuted,
  },
});
