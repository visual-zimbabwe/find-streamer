import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { themes } from '../theme/tokens';

/** Keep React Navigation native surfaces aligned with Trova light/dark tokens. */
export function buildNavigationTheme(resolvedMode) {
  const trova = themes[resolvedMode]?.colors ?? themes.light.colors;
  const base = resolvedMode === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: resolvedMode === 'dark',
    colors: {
      ...base.colors,
      primary: trova.primary,
      background: trova.background,
      card: trova.background,
      text: trova.onSurface,
      border: trova.outlineVariant,
      notification: trova.primary,
    },
  };
}
