import React, { createContext, useContext } from 'react';
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

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={THEME_VALUE}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
