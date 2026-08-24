export const gradient = {
  background: ['#2A2F38', '#1B1F24', '#101317'] as const,
  action: ['#22C55E', '#4ADE80'] as const,
};

export const colors = {
  background: '#14171B',
  surface: 'rgba(255, 255, 255, 0.07)',
  surfaceElevated: 'rgba(255, 255, 255, 0.11)',
  surfaceAlt: 'rgba(0, 0, 0, 0.22)',
  primary: '#22C55E',
  primaryMuted: 'rgba(74, 222, 128, 0.16)',
  glow: '#4ADE80',
  glowMuted: 'rgba(74, 222, 128, 0.16)',
  glowBorder: 'rgba(74, 222, 128, 0.55)',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  textOnPrimary: '#0B1210',
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  borderTopHighlight: 'rgba(255, 255, 255, 0.24)',
  danger: '#F87171',
  dangerMuted: 'rgba(248, 113, 113, 0.16)',
  success: '#4ADE80',
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
  shadowOpacity: 0.4,
  shadowRadius: 16,
  elevation: 8,
};

export const glowShadow = {
  shadowColor: colors.glow,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.4,
  shadowRadius: 10,
  elevation: 10,
};

export const glassBorder = {
  borderWidth: 1,
  borderColor: colors.border,
  borderTopColor: colors.borderTopHighlight,
};
