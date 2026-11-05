import React, { useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { PayrollButton } from './PayrollButton';
import { colors, spacing } from './tokens';

/**
 * Full-screen photo viewer (Jeff 2026-11-05, #0094 / #0078 photos). Pinch to zoom
 * (1x to 6x), drag to pan when zoomed, double-tap to toggle 1x / 2.5x. One Close
 * button at the top; the Android back gesture also closes it. No Back button added.
 * Built on PanResponder so it needs no extra native module.
 */
export type PhotoViewerProps = { uri: string; visible: boolean; onClose: () => void };

const MAX_SCALE = 6;
const DOUBLE_TAP_MS = 300;

function touchDistance(e: GestureResponderEvent): number {
  const t = e.nativeEvent.touches;
  const a = t[0];
  const b = t[1];
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

export function PhotoViewer({ uri, visible, onClose }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const cur = useRef({ scale: 1, tx: 0, ty: 0 });
  const base = useRef({ scale: 1, tx: 0, ty: 0, dist: 0, dx: 0, dy: 0 });
  const lastTap = useRef(0);
  const moved = useRef(false);

  const apply = (next: { scale: number; tx: number; ty: number }) => {
    const scale = Math.min(MAX_SCALE, Math.max(1, next.scale));
    // Keep the picture from being dragged completely off screen.
    const limX = (width * (scale - 1)) / 2;
    const limY = (height * (scale - 1)) / 2;
    const tx = scale === 1 ? 0 : Math.min(limX, Math.max(-limX, next.tx));
    const ty = scale === 1 ? 0 : Math.min(limY, Math.max(-limY, next.ty));
    cur.current = { scale, tx, ty };
    setView(cur.current);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        moved.current = false;
        base.current = { ...cur.current, dist: touchDistance(e), dx: 0, dy: 0 };
      },
      onPanResponderMove: (e, g) => {
        if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) moved.current = true;
        const d = touchDistance(e);
        if (d > 0) {
          if (base.current.dist === 0) {
            base.current = { ...cur.current, dist: d, dx: g.dx, dy: g.dy };
          }
          moved.current = true;
          apply({ scale: base.current.scale * (d / base.current.dist), tx: cur.current.tx, ty: cur.current.ty });
        } else if (cur.current.scale > 1) {
          if (base.current.dist !== 0) {
            // went from two fingers to one: restart the drag baseline
            base.current = { ...cur.current, dist: 0, dx: g.dx, dy: g.dy };
          }
          apply({
            scale: cur.current.scale,
            tx: base.current.tx + (g.dx - base.current.dx),
            ty: base.current.ty + (g.dy - base.current.dy),
          });
        }
      },
      onPanResponderRelease: () => {
        if (moved.current) return;
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          apply(cur.current.scale > 1 ? { scale: 1, tx: 0, ty: 0 } : { scale: 2.5, tx: 0, ty: 0 });
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      },
    }),
  ).current;

  const reset = () => {
    cur.current = { scale: 1, tx: 0, ty: 0 };
    setView(cur.current);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={reset}>
      <View style={styles.root}>
        <View style={styles.stage} {...pan.panHandlers}>
          <Image
            source={{ uri }}
            style={[
              styles.image,
              { transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale }] },
            ]}
            resizeMode="contain"
          />
        </View>
        <View style={styles.top} pointerEvents="box-none">
          <PayrollButton label="Close" onPress={onClose} testID="photo-viewer-close" />
        </View>
      </View>
    </Modal>
  );
}

/** A thumbnail that opens the full-screen viewer on tap. Drop-in for <Image>. */
export function PhotoThumb({
  uri,
  style,
  resizeMode = 'cover',
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
}) {
  const [open, setOpen] = useState(false);
  const flat = StyleSheet.flatten(style);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="View photo full size"
        style={{ width: flat?.width, height: flat?.height }}
      >
        <Image source={{ uri }} style={style} resizeMode={resizeMode} />
      </Pressable>
      <PhotoViewer uri={uri} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  top: { position: 'absolute', top: spacing.xxl, left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'flex-end' },
});
