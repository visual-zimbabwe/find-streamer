import { useMemo } from 'react';
import { useTheme } from '../theme/ThemeProvider';

/** Native-stack options shared by all tab stacks — theme-aware background. */
export function useStackScreenOptions() {
  const { theme } = useTheme();

  return useMemo(
    () => ({
      headerShown: false,
      animation: 'none',
      contentStyle: { backgroundColor: theme.colors.background },
    }),
    [theme.colors.background],
  );
}
