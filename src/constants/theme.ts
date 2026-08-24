export const gradient = {
  background: ['#E7EEE3', '#F7F6F1'] as const,
  action: ['#1A1A1A', '#0A0A0A'] as const,
};

export const colors = {
  background: '#F7F6F1',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceAlt: '#EEEDE7',
  primary: '#171717',
  primaryMuted: '#EEEDE7',
  glow: '#171717',
  glowMuted: '#FFFFFF',
  glowBorder: 'rgba(23, 23, 23, 0.1)',
  text: '#1C1F1B',
  textMuted: '#8B9088',
  textOnPrimary: '#FFFFFF',
  border: 'rgba(28, 31, 27, 0.08)',
  borderStrong: 'rgba(28, 31, 27, 0.14)',
  borderTopHighlight: 'rgba(28, 31, 27, 0.08)',
  danger: '#D92D20',
  success: '#12805C',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const },
  subtitle: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

export const glassShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 4,
};

export const glowShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 14,
  elevation: 8,
};

export const glassBorder = {
  borderWidth: 1,
  borderColor: colors.border,
  borderTopColor: colors.borderTopHighlight,
};
