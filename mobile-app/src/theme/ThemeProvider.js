import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { themes } from './tokens';
import { loadThemePreference, saveThemePreference } from '../lib/storage';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme() || Appearance.getColorScheme() || 'light';
  const [preference, setPreference] = useState('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadThemePreference()
      .then((value) => {
        if (active) setPreference(value);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const resolvedMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({
      ready,
      preference,
      resolvedMode,
      theme: themes[resolvedMode],
      setPreference: async (nextPreference) => {
        setPreference(nextPreference);
        await saveThemePreference(nextPreference);
      },
    }),
    [preference, ready, resolvedMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
