import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, glassBorder, glassShadow, radius, spacing } from '../constants/theme';

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...glassBorder,
    ...glassShadow,
  },
});
