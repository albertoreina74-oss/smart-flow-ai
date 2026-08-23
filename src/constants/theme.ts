export const gradient = {
  background: ['#1E1B4B', '#4C1D95', '#0F172A'] as const,
  action: ['#007AFF', '#00F0FF'] as const,
};

export const colors = {
  background: '#0F172A',
  surface: 'rgba(255, 255, 255, 0.12)',
  surfaceElevated: 'rgba(255, 255, 255, 0.18)',
  surfaceAlt: 'rgba(15, 23, 42, 0.4)',
  primary: '#007AFF',
  primaryMuted: 'rgba(0, 122, 255, 0.2)',
  glow: '#00F0FF',
  glowMuted: 'rgba(0, 240, 255, 0.2)',
  glowBorder: 'rgba(0, 240, 255, 0.8)',
  text: '#FFFFFF',
  textMuted: '#E2E8F0',
  border: 'rgba(255, 255, 255, 0.3)',
  borderStrong: 'rgba(255, 255, 255, 0.4)',
  borderTopHighlight: 'rgba(255, 255, 255, 0.65)',
  danger: '#FF453A',
  success: '#30D158',
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
  shadowOpacity: 0.35,
  shadowRadius: 16,
  elevation: 8,
};

export const glowShadow = {
  shadowColor: colors.glow,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.5,
  shadowRadius: 10,
  elevation: 10,
};

export const glassBorder = {
  borderWidth: 1.5,
  borderColor: colors.border,
  borderTopColor: colors.borderTopHighlight,
};
