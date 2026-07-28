import { DarkTheme } from '@react-navigation/native';
import { theme } from '../theme/tokens';

/**
 * Keep React Navigation's native surfaces aligned with Trova's dark tokens.
 * A constant rather than a builder — the app has one theme, so there is nothing
 * to rebuild and nothing for AppShell to memoize.
 */
export const navigationTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.background,
    text: theme.colors.onSurface,
    border: theme.colors.outlineVariant,
    notification: theme.colors.primary,
  },
};
