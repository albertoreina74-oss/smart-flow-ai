import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, glassBorder, glowShadow, gradient, radius, spacing, typography } from '../constants/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', style, disabled }: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={[styles.primaryWrapper, disabled && styles.disabled, style]}
      >
        <LinearGradient colors={gradient.action} style={styles.base}>
          <Text style={styles.label}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.base, styles.secondary, disabled && styles.disabled, style]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryWrapper: {
    borderRadius: radius.md,
    ...glowShadow,
  },
  secondary: {
    backgroundColor: colors.surfaceAlt,
    ...glassBorder,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.text,
    ...typography.subtitle,
  },
});
