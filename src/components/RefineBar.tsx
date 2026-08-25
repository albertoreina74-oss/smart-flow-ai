import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Briefcase, Maximize2, Minimize2, SendHorizontal, Undo2, WandSparkles } from 'lucide-react-native';
import { REFINEMENTS, RefinementId } from '../constants/refinements';
import { colors, glassBorder, radius, spacing, typography } from '../constants/theme';

type RefineBarProps = {
  onRefine: (instruction: string, label: string) => void;
  onUndo: () => void;
  canUndo: boolean;
  isRefining: boolean;
  disabled?: boolean;
};

const REFINEMENT_ICONS: Record<RefinementId, React.ComponentType<{ color: string; size: number }>> = {
  shorter: Minimize2,
  formal: Briefcase,
  simpler: WandSparkles,
  expand: Maximize2,
};

export function RefineBar({ onRefine, onUndo, canUndo, isRefining, disabled }: RefineBarProps) {
  const [customInstruction, setCustomInstruction] = useState('');
  const isBusy = isRefining || disabled;

  const submitCustom = () => {
    const trimmed = customInstruction.trim();
    if (!trimmed || isBusy) {
      return;
    }
    setCustomInstruction('');
    onRefine(trimmed, 'Su misura');
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Non è come volevi?</Text>
        {canUndo && (
          <Pressable
            style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]}
            onPress={onUndo}
            disabled={isBusy}
            hitSlop={8}
          >
            <Undo2 color={colors.textMuted} size={14} />
            <Text style={styles.undoLabel}>Annulla modifica</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.chipRow}>
        {REFINEMENTS.map((refinement) => {
          const Icon = REFINEMENT_ICONS[refinement.id];
          return (
            <Pressable
              key={refinement.id}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed, isBusy && styles.chipDisabled]}
              onPress={() => onRefine(refinement.instruction, refinement.label)}
              disabled={isBusy}
            >
              <Icon color={colors.glow} size={14} />
              <Text style={styles.chipLabel}>{refinement.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.customRow}>
        <TextInput
          value={customInstruction}
          onChangeText={setCustomInstruction}
          placeholder="Oppure chiedi una modifica..."
          placeholderTextColor={colors.textMuted}
          style={styles.customInput}
          editable={!isBusy}
          returnKeyType="send"
          onSubmitEditing={submitCustom}
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            pressed && styles.pressed,
            (!customInstruction.trim() || isBusy) && styles.chipDisabled,
          ]}
          onPress={submitCustom}
          disabled={!customInstruction.trim() || isBusy}
        >
          {isRefining ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <SendHorizontal color={colors.textOnPrimary} size={18} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textMuted,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  undoLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    ...glassBorder,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipLabel: {
    color: colors.text,
    ...typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customInput: {
    flex: 1,
    color: colors.text,
    ...typography.body,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    ...glassBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
