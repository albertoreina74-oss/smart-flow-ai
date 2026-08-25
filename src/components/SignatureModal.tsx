import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Check, Eraser, X } from 'lucide-react-native';
import { colors, glassBorder, radius, spacing, typography } from '../constants/theme';
import { AppModal } from './Modal';
import { saveSignature } from '../services/storageService';

type SignatureModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: (dataUri: string) => void;
};

const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 180;
const INK_COLOR = '#161B22';

export function SignatureModal({ visible, onClose, onSaved }: SignatureModalProps) {
  const svgRef = useRef<Svg>(null);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const hasDrawing = strokes.length > 0 || currentPath.length > 0;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          setCurrentPath(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          setCurrentPath((path) => `${path} L${locationX.toFixed(1)},${locationY.toFixed(1)}`);
        },
        onPanResponderRelease: () => {
          setCurrentPath((path) => {
            if (path) {
              setStrokes((existing) => [...existing, path]);
            }
            return '';
          });
        },
      }),
    [],
  );

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStrokes([]);
    setCurrentPath('');
  };

  const handleClose = () => {
    setStrokes([]);
    setCurrentPath('');
    onClose();
  };

  const handleSave = () => {
    if (!hasDrawing || isSaving) {
      return;
    }
    setIsSaving(true);
    svgRef.current?.toDataURL(async (base64) => {
      try {
        const dataUri = `data:image/png;base64,${base64}`;
        await saveSignature(dataUri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSaved(dataUri);
        setStrokes([]);
        setCurrentPath('');
        onClose();
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <AppModal visible={visible} onClose={handleClose}>
      <Text style={styles.title}>Firma digitale</Text>
      <Text style={styles.subtitle}>Disegna la firma con il dito, verrà salvata su questo dispositivo.</Text>

      <View style={styles.canvasWrapper} {...panResponder.panHandlers}>
        <Svg ref={svgRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
          {strokes.map((path, index) => (
            <Path
              key={index}
              d={path}
              stroke={INK_COLOR}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {currentPath ? (
            <Path
              d={currentPath}
              stroke={INK_COLOR}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </Svg>
        {!hasDrawing && <Text style={styles.placeholder}>Firma qui</Text>}
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={handleClear}>
          <Eraser color={colors.text} size={18} />
          <Text style={styles.secondaryButtonLabel}>Pulisci</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={handleClose}>
          <X color={colors.text} size={18} />
          <Text style={styles.secondaryButtonLabel}>Chiudi</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          (!hasDrawing || isSaving || pressed) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!hasDrawing || isSaving}
      >
        <Check color={colors.textOnPrimary} size={18} />
        <Text style={styles.saveButtonLabel}>{isSaving ? 'Salvataggio...' : 'Salva firma'}</Text>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    ...typography.body,
    marginBottom: spacing.md,
  },
  canvasWrapper: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    ...glassBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    position: 'absolute',
    color: 'rgba(11, 18, 16, 0.28)',
    ...typography.subtitle,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    paddingVertical: spacing.sm,
  },
  buttonPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  secondaryButtonLabel: {
    color: colors.text,
    ...typography.body,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonLabel: {
    color: colors.textOnPrimary,
    ...typography.subtitle,
    fontWeight: '700',
  },
});
