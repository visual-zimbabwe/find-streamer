import { scale, scaleFont } from '../utils/responsive';

/**
 * Font family names as registered by expo-font (see `FONT_MAP` in App.js).
 * Each name maps to a single weighted font file — on Android the `fontWeight`
 * style is ignored once a weighted family is set, so it is kept alongside only
 * as a graceful fallback if a face ever fails to load.
 */
export const fonts = {
  display: 'Manrope_800ExtraBold', // Editorial display / hero
  heading: 'Manrope_700Bold', // Headlines, titles, section headers
  body: 'Inter_400Regular', // Body copy, metadata
  label: 'Inter_600SemiBold', // Eyebrows, labels, chips
};

export const spacing = {
  1: scale(4),
  2: scale(8),
  3: scale(12),
  4: scale(16),
  5: scale(20),
  6: scale(24),
  7: scale(28),
  8: scale(32),
  10: scale(40),
  12: scale(48),
  14: scale(56),
};

export const radii = {
  sm: scale(4),
  md: scale(8),
  lg: scale(12),
  xl: scale(24),
  full: 9999,
};

export const typography = {
  displayLg: {
    fontSize: scaleFont(56),
    lineHeight: scaleFont(64),
    fontWeight: '800',
    letterSpacing: -1.12,
    fontFamily: fonts.display,
  },
  headlineLg: {
    fontSize: scaleFont(32),
    lineHeight: scaleFont(40),
    fontWeight: '700',
    fontFamily: fonts.heading,
  },
  headlineMd: {
    fontSize: scaleFont(28),
    lineHeight: scaleFont(36),
    fontWeight: '700',
    fontFamily: fonts.heading,
  },
  titleLg: {
    fontSize: scaleFont(22),
    lineHeight: scaleFont(28),
    fontWeight: '700',
    fontFamily: fonts.heading,
  },
  titleMd: {
    fontSize: scaleFont(18),
    lineHeight: scaleFont(24),
    fontWeight: '700',
    fontFamily: fonts.heading,
  },
  bodyLg: {
    fontSize: scaleFont(18),
    lineHeight: scaleFont(28),
    fontWeight: '400',
    fontFamily: fonts.body,
  },
  bodyMd: {
    fontSize: scaleFont(14),
    lineHeight: scaleFont(20),
    fontWeight: '400',
    fontFamily: fonts.body,
  },
  labelSm: {
    fontSize: scaleFont(11),
    lineHeight: scaleFont(16),
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: fonts.label,
  },
};

const trovaDark = {
  background: '#000000',
  surface: '#0B0B0B',
  surfaceContainerLow: '#0B0B0B',
  surfaceContainer: '#121212',
  surfaceContainerHigh: '#1A1A1A',
  surfaceContainerHighest: '#222222',
  primary: '#a78bfa',
  primaryDim: '#8b6ff0',
  primaryContainer: '#1a1330',
  onPrimary: '#0d0820',
  onSurface: '#f5f5f7',
  onSurfaceVariant: '#8E8E93',
  outlineVariant: '#3a3a3c',
  error: '#ff453a',
  white: '#ffffff',
  black: '#000000',
  glass: 'rgba(12, 12, 14, 0.94)',
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
