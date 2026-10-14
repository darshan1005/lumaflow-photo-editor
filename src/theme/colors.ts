export const colors = {
  // Darkroom Base
  background: '#121316',
  surface: '#1a1b20',
  surfaceElevated: '#23252c',
  surfaceCard: '#2d303a',
  surfaceHover: '#363a46',

  // Borders
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderMedium: 'rgba(255, 255, 255, 0.16)',
  borderActive: '#0075ff',

  // Text
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  textInverse: '#18181b',

  // Accents & Signals
  accentPrimary: '#0075ff',
  accentPrimaryHover: '#0062d6',
  accentSecondary: '#38bdf8',
  accentWarning: '#f59e0b',
  accentSuccess: '#22c55e',
  accentDanger: '#ef4444',

  // Gradient Rails
  trackCool: '#2563eb',
  trackWarm: '#d97706',
  trackGreen: '#16a34a',
  trackMagenta: '#c026d3'
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const typography = {
  titleLarge: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.4 },
  titleMedium: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.2 },
  bodyRegular: { fontSize: 14, fontWeight: '400' as const },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const },
  labelSmall: { fontSize: 12, fontWeight: '500' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
  numeric: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'monospace' }
};
