import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, glassBorder, glassShadow, radius, spacing, typography } from '../constants/theme';

type ToastProps = {
  message: string;
  visible: boolean;
};

export function Toast({ message, visible }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!message) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    ...glassBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...glassShadow,
  },
  text: {
    color: colors.text,
    ...typography.body,
    fontWeight: '600',
  },
});
