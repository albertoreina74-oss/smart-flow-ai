import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Modal as RNModal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Maximize } from 'lucide-react-native';
import { colors, glassBorder, radius, spacing, typography } from '../constants/theme';
import type { NormalizedCropRect } from '../services/scanEnhanceService';

export type CropRequest = {
  uri: string;
  width: number;
  height: number;
  /** 0-based page position, only set when cropping a multi-page batch. */
  index?: number;
  total?: number;
};

type CropModalProps = {
  request: CropRequest | null;
  onConfirm: (rect: NormalizedCropRect) => void;
  onCancel: () => void;
};

type Box = { x: number; y: number; width: number; height: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';
type Drag =
  | { kind: 'move' }
  | { kind: 'resize'; corner: Corner }
  | { kind: 'draw'; anchorX: number; anchorY: number };

// How close a touch has to land to a corner before it grabs that handle
// rather than moving the whole selection. Generous on purpose — the visible
// handles are small, and fingers are not.
const HANDLE_GRAB_RADIUS = 36;
const MIN_SELECTION = 44;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

/**
 * The letterboxed rectangle the image actually occupies inside `container`
 * once it's been laid out with `resizeMode="contain"`. Everything else in
 * this component works in coordinates relative to this box's top-left.
 */
function fitImageBox(container: { width: number; height: number }, imageAspect: number): Box {
  if (container.width <= 0 || container.height <= 0 || !Number.isFinite(imageAspect) || imageAspect <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const containerAspect = container.width / container.height;
  if (imageAspect > containerAspect) {
    const height = container.width / imageAspect;
    return { x: 0, y: (container.height - height) / 2, width: container.width, height };
  }
  const width = container.height * imageAspect;
  return { x: (container.width - width) / 2, y: 0, width, height: container.height };
}

export function CropModal({ request, onConfirm, onCancel }: CropModalProps) {
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<Box>({ x: 0, y: 0, width: 0, height: 0 });

  // PanResponder callbacks are created once and would otherwise close over
  // stale state, so the gesture reads and writes through refs and mirrors
  // the result into state purely for rendering.
  const selectionRef = useRef<Box>(selection);
  const dragStartRef = useRef<Box>(selection);
  const dragRef = useRef<Drag | null>(null);
  const imageBoxRef = useRef<Box>({ x: 0, y: 0, width: 0, height: 0 });

  const imageBox = useMemo(
    () => fitImageBox(container, request ? request.width / request.height : 0),
    [container, request],
  );
  imageBoxRef.current = imageBox;

  const applySelection = (next: Box) => {
    selectionRef.current = next;
    setSelection(next);
  };

  // Start every image selected in full: confirming without touching anything
  // then behaves exactly like the previous no-crop flow.
  useEffect(() => {
    applySelection({ x: 0, y: 0, width: imageBox.width, height: imageBox.height });
  }, [imageBox.width, imageBox.height, request?.uri]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          const rect = selectionRef.current;
          dragStartRef.current = rect;

          const corners: Record<Corner, { x: number; y: number }> = {
            tl: { x: rect.x, y: rect.y },
            tr: { x: rect.x + rect.width, y: rect.y },
            bl: { x: rect.x, y: rect.y + rect.height },
            br: { x: rect.x + rect.width, y: rect.y + rect.height },
          };
          const grabbed = (Object.keys(corners) as Corner[]).find((corner) => {
            const point = corners[corner];
            return Math.hypot(locationX - point.x, locationY - point.y) <= HANDLE_GRAB_RADIUS;
          });

          if (grabbed) {
            dragRef.current = { kind: 'resize', corner: grabbed };
          } else if (
            locationX >= rect.x &&
            locationX <= rect.x + rect.width &&
            locationY >= rect.y &&
            locationY <= rect.y + rect.height
          ) {
            dragRef.current = { kind: 'move' };
          } else {
            // Touch landed outside the current selection: treat the drag as
            // drawing a brand new one from that point.
            dragRef.current = { kind: 'draw', anchorX: locationX, anchorY: locationY };
          }
          Haptics.selectionAsync();
        },
        onPanResponderMove: (_event, gesture) => {
          const drag = dragRef.current;
          const box = imageBoxRef.current;
          if (!drag || box.width <= 0) {
            return;
          }
          const start = dragStartRef.current;

          if (drag.kind === 'move') {
            applySelection({
              ...start,
              x: clamp(start.x + gesture.dx, 0, box.width - start.width),
              y: clamp(start.y + gesture.dy, 0, box.height - start.height),
            });
            return;
          }

          if (drag.kind === 'draw') {
            const x1 = clamp(drag.anchorX, 0, box.width);
            const y1 = clamp(drag.anchorY, 0, box.height);
            const x2 = clamp(drag.anchorX + gesture.dx, 0, box.width);
            const y2 = clamp(drag.anchorY + gesture.dy, 0, box.height);
            applySelection({
              x: Math.min(x1, x2),
              y: Math.min(y1, y2),
              width: Math.max(MIN_SELECTION, Math.abs(x2 - x1)),
              height: Math.max(MIN_SELECTION, Math.abs(y2 - y1)),
            });
            return;
          }

          const right = start.x + start.width;
          const bottom = start.y + start.height;
          const pullsLeftEdge = drag.corner === 'tl' || drag.corner === 'bl';
          const pullsTopEdge = drag.corner === 'tl' || drag.corner === 'tr';

          const x = pullsLeftEdge ? clamp(start.x + gesture.dx, 0, right - MIN_SELECTION) : start.x;
          const y = pullsTopEdge ? clamp(start.y + gesture.dy, 0, bottom - MIN_SELECTION) : start.y;
          const width = pullsLeftEdge
            ? right - x
            : clamp(start.width + gesture.dx, MIN_SELECTION, box.width - start.x);
          const height = pullsTopEdge
            ? bottom - y
            : clamp(start.height + gesture.dy, MIN_SELECTION, box.height - start.y);

          applySelection({ x, y, width, height });
        },
        onPanResponderRelease: () => {
          dragRef.current = null;
        },
        onPanResponderTerminate: () => {
          dragRef.current = null;
        },
      }),
    [],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainer({ width, height });
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    applySelection({ x: 0, y: 0, width: imageBox.width, height: imageBox.height });
  };

  const handleConfirm = () => {
    if (imageBox.width <= 0 || imageBox.height <= 0) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const rect = selectionRef.current;
    onConfirm({
      originX: clamp(rect.x / imageBox.width, 0, 1),
      originY: clamp(rect.y / imageBox.height, 0, 1),
      width: clamp(rect.width / imageBox.width, 0, 1),
      height: clamp(rect.height / imageBox.height, 0, 1),
    });
  };

  const pageLabel =
    request?.total && request.total > 1 ? `Pagina ${(request.index ?? 0) + 1} di ${request.total}` : null;

  return (
    <RNModal
      visible={request !== null}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <Text style={styles.title}>Seleziona l'area da estrarre</Text>
          <Text style={styles.subtitle}>
            {pageLabel
              ? `${pageLabel} · trascina per stringere il riquadro sul testo`
              : 'Trascina il riquadro o i suoi angoli sul testo che ti interessa'}
          </Text>
        </View>

        <View style={styles.stage} onLayout={handleLayout}>
          {request !== null && imageBox.width > 0 && (
            <View
              style={[
                styles.imageBox,
                { left: imageBox.x, top: imageBox.y, width: imageBox.width, height: imageBox.height },
              ]}
              {...panResponder.panHandlers}
            >
              <Image source={{ uri: request.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />

              {/* Four shades around the selection, so the kept area reads as
                  the only lit part of the photo. */}
              <View pointerEvents="none" style={[styles.shade, { left: 0, right: 0, top: 0, height: selection.y }]} />
              <View
                pointerEvents="none"
                style={[styles.shade, { left: 0, right: 0, top: selection.y + selection.height, bottom: 0 }]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.shade,
                  { left: 0, top: selection.y, width: selection.x, height: selection.height },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.shade,
                  {
                    left: selection.x + selection.width,
                    right: 0,
                    top: selection.y,
                    height: selection.height,
                  },
                ]}
              />

              <View
                pointerEvents="none"
                style={[
                  styles.selection,
                  {
                    left: selection.x,
                    top: selection.y,
                    width: selection.width,
                    height: selection.height,
                  },
                ]}
              >
                <View style={[styles.handle, styles.handleTl]} />
                <View style={[styles.handle, styles.handleTr]} />
                <View style={[styles.handle, styles.handleBl]} />
                <View style={[styles.handle, styles.handleBr]} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.resetButton} onPress={handleReset}>
            <Maximize color={colors.text} size={18} />
            <Text style={styles.resetLabel}>Tutta l'immagine</Text>
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelLabel}>Annulla</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.confirmButton]} onPress={handleConfirm}>
              <Check color={colors.textOnPrimary} size={18} />
              <Text style={styles.confirmLabel}>Estrai testo</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0B0E11',
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.text,
    ...typography.title,
    fontSize: 20,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.caption,
  },
  stage: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  imageBox: {
    position: 'absolute',
    overflow: 'hidden',
  },
  shade: {
    position: 'absolute',
    backgroundColor: 'rgba(6, 9, 12, 0.68)',
  },
  selection: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.glow,
  },
  handle: {
    position: 'absolute',
    width: 18,
    height: 18,
    backgroundColor: colors.glow,
    borderRadius: radius.sm / 2,
  },
  handleTl: { left: -9, top: -9 },
  handleTr: { right: -9, top: -9 },
  handleBl: { left: -9, bottom: -9 },
  handleBr: { right: -9, bottom: -9 },
  actions: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    ...glassBorder,
  },
  resetLabel: {
    color: colors.text,
    ...typography.body,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  cancelButton: {
    backgroundColor: colors.surfaceAlt,
    ...glassBorder,
  },
  cancelLabel: {
    color: colors.text,
    ...typography.subtitle,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmLabel: {
    color: colors.textOnPrimary,
    ...typography.subtitle,
  },
});
