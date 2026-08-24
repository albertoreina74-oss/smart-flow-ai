import React from 'react';
import { Modal as RNModal, Pressable, StyleSheet, View } from 'react-native';
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
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <X color={colors.textMuted} size={20} />
          </Pressable>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    // Modals sit on top of arbitrary screen content, unlike cards which sit on
    // our own gradient — they need a near-opaque background or the content
    // behind bleeds through and becomes unreadable.
    backgroundColor: 'rgba(20, 24, 28, 0.98)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...glassBorder,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  },
});
