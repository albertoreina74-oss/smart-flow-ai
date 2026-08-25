import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, glassBorder, radius, spacing, typography } from '../constants/theme';

export type ExportSheetOption = {
  key: string;
  label: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  onPress: () => void;
  loading?: boolean;
};

type ExportSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: ExportSheetOption[];
  /** Optional controls (e.g. a quality toggle) rendered above the option list. */
  header?: React.ReactNode;
};

export function ExportSheet({ visible, onClose, title = 'Esporta / Condividi', options, header }: ExportSheetProps) {
  const insets = useSafeAreaInsets();

  const handleSelect = (option: ExportSheetOption) => {
    if (option.loading) {
      return;
    }
    onClose();
    option.onPress();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={28} tint="dark" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>
          {header}
          <View style={styles.optionsCard}>
            {options.map((option, index) => (
              <Pressable
                key={option.key}
                style={({ pressed }) => [
                  styles.row,
                  index < options.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => handleSelect(option)}
              >
                {option.loading ? (
                  <ActivityIndicator color={colors.glow} size="small" />
                ) : (
                  <option.icon color={colors.glow} size={20} />
                )}
                <Text style={styles.rowLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]} onPress={onClose}>
            <Text style={styles.cancelLabel}>Annulla</Text>
          </Pressable>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.xs,
  },
  title: {
    alignSelf: 'center',
    color: colors.textMuted,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  optionsCard: {
    backgroundColor: 'rgba(20, 24, 28, 0.98)',
    borderRadius: radius.lg,
    ...glassBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  rowLabel: {
    color: colors.text,
    ...typography.subtitle,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'rgba(20, 24, 28, 0.98)',
    borderRadius: radius.lg,
    ...glassBorder,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelButtonPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  cancelLabel: {
    color: colors.glow,
    ...typography.subtitle,
    fontWeight: '700',
  },
});
