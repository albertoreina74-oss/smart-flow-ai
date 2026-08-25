import React from 'react';
import { Modal as RNModal, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { colors, glassBorder, radius, spacing } from '../constants/theme';

type AppModalProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function AppModal({ visible, onClose, children }: AppModalProps) {
  return (
    <RNModal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <BlurView intensity={28} tint="dark" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <X color={colors.textMuted} size={20} />
          </Pressable>
          {children}
        </View>
      </BlurView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    // Modals sit on top of arbitrary screen content, unlike cards which sit on
    // our own gradient — they need a near-opaque background or the content
    // behind bleeds through and becomes unreadable.
    backgroundColor: 'rgba(20, 24, 28, 0.98)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...glassBorder,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 1,
  },
});
