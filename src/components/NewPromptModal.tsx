import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, glassBorder, radius, spacing, typography } from '../constants/theme';
import { AppModal } from './Modal';

type NewPromptModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (label: string, prompt: string) => void;
};

export function NewPromptModal({ visible, onClose, onSave }: NewPromptModalProps) {
  const [label, setLabel] = useState('');
  const [prompt, setPrompt] = useState('');

  const canSave = label.trim().length > 0 && prompt.trim().length > 0;

  const handleClose = () => {
    setLabel('');
    setPrompt('');
    onClose();
  };

  const handleSave = () => {
    if (!canSave) {
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(label.trim(), prompt.trim());
    setLabel('');
    setPrompt('');
  };

  return (
    <AppModal visible={visible} onClose={handleClose}>
      <Text style={styles.title}>Nuova modalità</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="Es. Tono ironico"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <Text style={[styles.label, styles.promptLabel]}>Prompt</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Descrivi come vuoi che Gemini rielabori il testo..."
        placeholderTextColor={colors.textMuted}
        multiline
        style={[styles.input, styles.promptInput]}
      />

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          (!canSave || pressed) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <Text style={styles.saveButtonLabel}>Salva modalità</Text>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    ...typography.title,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  promptLabel: {
    marginTop: spacing.md,
  },
  input: {
    color: colors.text,
    ...typography.body,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    padding: spacing.md,
  },
  promptInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
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
