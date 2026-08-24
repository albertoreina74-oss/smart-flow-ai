import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { GEMINI_MODEL } from '../services/geminiService';
import { colors, radius, spacing, typography } from '../constants/theme';
import { AppModal } from './Modal';

type SettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
};

function describeTemperature(value: number): string {
  if (value <= 0.3) {
    return 'Precisa e prevedibile';
  }
  if (value <= 0.7) {
    return 'Bilanciata';
  }
  return 'Creativa e variabile';
}

export function SettingsModal({
  visible,
  onClose,
  temperature,
  onTemperatureChange,
}: SettingsModalProps) {
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>Impostazioni</Text>

      <Text style={styles.label}>Modello AI</Text>
      <View style={styles.modelBadge}>
        <Text style={styles.modelBadgeText}>{GEMINI_MODEL}</Text>
      </View>

      <Text style={[styles.label, styles.sliderLabel]}>
        Temperatura · {temperature.toFixed(1)}
      </Text>
      <Text style={styles.description}>{describeTemperature(temperature)}</Text>
      <Slider
        minimumValue={0}
        maximumValue={1}
        step={0.1}
        value={temperature}
        onValueChange={(value) => {
          Haptics.selectionAsync();
          onTemperatureChange(value);
        }}
        minimumTrackTintColor={colors.glow}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.glow}
        style={styles.slider}
      />
      <View style={styles.sliderScale}>
        <Text style={styles.scaleLabel}>Precisa</Text>
        <Text style={styles.scaleLabel}>Creativa</Text>
      </View>
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
    marginBottom: spacing.sm,
  },
  modelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.glowMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glowBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  modelBadgeText: {
    color: colors.glow,
    ...typography.body,
    fontWeight: '700',
  },
  sliderLabel: {
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.text,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
});
