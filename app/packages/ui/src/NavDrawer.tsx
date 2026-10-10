import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from './tokens';
import { DRAWER_HEADER_HEIGHT, clamp01, drawerWidth, shouldClaimSwipe, shouldDismiss } from './drawer-geometry';

export type NavDrawerProps = {
  visible: boolean;
  onClose: () => void;
  progress: Animated.Value;
  header: ReactNode;
  children: ReactNode;
};

const USE_NATIVE = Platform.OS !== 'web';

export function NavDrawer({ visible, onClose, progress, header, children }: NavDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const width = drawerWidth(screenW);

  useEffect(() => {
    progress.stopAnimation();
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress]);

  const pan = useMemo(() => {
    const settle = (_: unknown, g: { dx: number; vx: number }) => {
      if (shouldDismiss(g.dx, g.vx, width)) {
        onClose();
      } else {
        progress.stopAnimation();
        Animated.timing(progress, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE,
        }).start();
      }
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => shouldClaimSwipe(g.dx, g.dy),
      onPanResponderGrant: () => progress.stopAnimation(),
      onPanResponderMove: (_, g) => progress.setValue(clamp01(1 + g.dx / width)),
      onPanResponderRelease: settle,
      onPanResponderTerminate: settle,
    });
  }, [width, onClose, progress]);

  return (
    <Modal transparent visible={mounted} animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.overlay,
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
            },
          ]}
        />
      </Pressable>
      <Animated.View
        accessibilityViewIsModal
        {...pan.panHandlers}
        style={[
          styles.panel,
          {
            width,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }],
          },
        ]}
      >
        <Animated.View
          style={[styles.header, { height: DRAWER_HEADER_HEIGHT + insets.top }]}
        >
          {header}
        </Animated.View>
        <ScrollView style={styles.scroll}>{children}</ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    justifyContent: 'flex-end',
  },
  scroll: { flex: 1 },
});
