import React, { createContext, useContext, useMemo } from 'react';
import { theme } from './tokens';

/**
 * Trova is dark-only. This provider used to resolve a stored preference against
 * the system color scheme; there is nothing left to resolve, so it publishes one
 * frozen value. It stays a context rather than a bare import so the `useTheme()`
 * call sites — which is nearly every component — keep working unchanged, and so
 * a future per-screen theme override (e.g. poster-derived accents) has a seam to
 * hook into.
 */
const ThemeContext = createContext(null);

const THEME_VALUE = { theme };

/**
 * `theme` is optional: omitted at the app root (publishes the frozen default);
 * passed by a nested provider to override colors for one subtree only.
 */
export function ThemeProvider({ children, theme: override }) {
  const value = useMemo(() => (override ? { theme: override } : THEME_VALUE), [override]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
