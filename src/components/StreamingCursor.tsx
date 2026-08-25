import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

/** A pulsing caret shown at the end of text while a Gemini response is still streaming in. */
export function StreamingCursor() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 450, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.cursor, { opacity }]} />;
}

const styles = StyleSheet.create({
  cursor: {
    width: 7,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.glow,
    marginLeft: 3,
    marginBottom: 2,
  },
});
