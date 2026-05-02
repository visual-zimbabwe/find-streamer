export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
};

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 24,
  full: 9999,
};

export const typography = {
  displayLg: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '800',
    letterSpacing: -1.12,
    fontFamily: 'System', // Placeholder for Manrope
  },
  headlineLg: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    fontFamily: 'System', // Placeholder for Manrope
  },
  headlineMd: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: 'System', // Placeholder for Manrope
  },
  titleLg: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: 'System', // Placeholder for Manrope
  },
  bodyLg: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
    fontFamily: 'System', // Placeholder for Inter
  },
  bodyMd: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'System', // Placeholder for Inter
  },
  labelSm: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: 'System', // Placeholder for Inter
  },
};

const trovaDark = {
  background: '#0a0e14',
  surface: '#0a0e14',
  surfaceContainerLow: '#0f141a',
  surfaceContainer: '#151a21',
  surfaceContainerHigh: '#1b2028',
  surfaceContainerHighest: '#20262f',
  primary: '#9aa8ff',
  primaryDim: '#8998f0',
  primaryContainer: '#8c9bf3',
  onPrimary: '#122479',
  onSurface: '#f1f3fc',
  onSurfaceVariant: '#a8abb3',
  outlineVariant: '#44484f',
  error: '#ff6e84',
  white: '#ffffff',
  black: '#000000',
  glass: 'rgba(10, 14, 20, 0.8)',
};

const trovaLight = {
  background: '#f7f7f2',
  surface: '#ffffff',
  surfaceContainerLow: '#ffffff',
  surfaceContainer: '#ecece4',
  surfaceContainerHigh: '#e1e2d8',
  surfaceContainerHighest: '#d6d8cb',
  primary: '#4457d3',
  primaryDim: '#3346bc',
  primaryContainer: '#dfe3ff',
  onPrimary: '#ffffff',
  onSurface: '#181b21',
  onSurfaceVariant: '#61646d',
  outlineVariant: '#b7baaa',
  error: '#b3263a',
  white: '#ffffff',
  black: '#000000',
  glass: 'rgba(247, 247, 242, 0.86)',
};

export const themes = {
  light: {
    mode: 'light',
    colors: { ...trovaLight },
    spacing,
    radii,
    typography,
  },
  dark: {
    mode: 'dark',
    colors: { ...trovaDark },
    spacing,
    radii,
    typography,
  },
};
