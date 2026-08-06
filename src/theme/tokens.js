import { scale, scaleFont } from '../utils/responsive';
import { GOLD_ACCENT } from './programme';

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
  // The "Trova" logotype. Was the device system serif (Android `serif` /
  // iOS `Georgia`), which rendered a different, uncontrolled face per device on
  // the one screen where type IS the brand. A single bundled Bold-Italic serif
  // keeps the launch intro and every in-app wordmark pixel-identical. On Android
  // the weighted family carries the weight+italic, so `fontWeight`/`fontStyle`
  // alongside it are graceful fallbacks only (see note above).
  wordmark: 'PlayfairDisplay_700Bold_Italic',
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

/**
 * Accent identity — one gold system.
 *
 * Trova's single accent is the gold defined in theme/programme.js
 * (GOLD_ACCENT), used by all marquee chrome (BottomNav, rails, eyebrows). The
 * `primary*` slots below are repointed to that same gold so no purple/blue
 * leaks into user-facing surfaces — buttons, active/selected states, the
 * empty-poster fallback, and React Navigation's link/notification color, which
 * derives from `primary` in navigationTheme.js.
 *
 * The `primary` slot is kept in the theme shape (not removed) because
 * usePosterTheme.js overrides it per-poster with a dynamic accent extracted
 * from the artwork; the values here are only the fallback when no poster
 * palette is active. `onPrimary` is a dark warm ink so text/icons stay legible
 * on gold.
 */
const GOLD_DIM_SOLID = '#b58e46'; // darker gold for dim/pressed accent states
const GOLD_ON = '#1a1204'; // near-black warm ink for content sitting on gold

const trovaDark = {
  background: '#000000',
  surface: '#0B0B0B',
  surfaceContainerLow: '#0B0B0B',
  surfaceContainer: '#121212',
  surfaceContainerHigh: '#1A1A1A',
  surfaceContainerHighest: '#222222',
  primary: GOLD_ACCENT,
  primaryDim: GOLD_DIM_SOLID,
  primaryContainer: '#231b0e',
  onPrimary: GOLD_ON,
  onSurface: '#f5f5f7',
  onSurfaceVariant: '#8E8E93',
  outlineVariant: '#3a3a3c',
  error: '#ff453a',
  white: '#ffffff',
  black: '#000000',
  glass: 'rgba(12, 12, 14, 0.94)',
};

/**
 * Trova is a dark-only app. There is no light palette and no runtime mode
 * switch: the gold-on-black marquee treatment is the product's identity, and
 * every surface, scrim, poster gradient and glass blur in the app is tuned
 * against a black background. A single frozen theme object means components can
 * read colors without ever branching on mode.
 */
export const theme = {
  mode: 'dark',
  colors: { ...trovaDark },
  spacing,
  radii,
  typography,
};
