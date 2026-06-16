import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { themes } from './tokens';
import { loadThemePreference, saveThemePreference } from '../lib/storage';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const hookScheme = useColorScheme();
  const [systemScheme, setSystemScheme] = useState(() => Appearance.getColorScheme() ?? hookScheme ?? 'light');
  const [preference, setPreference] = useState('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setSystemScheme(colorScheme);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (hookScheme) {
      setSystemScheme(hookScheme);
    }
  }, [hookScheme]);

  useEffect(() => {
    let active = true;
    loadThemePreference()
      .then((value) => {
        if (active) setPreference(value);
      })
      .finally(() => {
        if (active) {
          const latestScheme = Appearance.getColorScheme() ?? hookScheme ?? 'light';
          setSystemScheme(latestScheme);
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [hookScheme]);

  const resolvedMode = preference === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : preference;

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
