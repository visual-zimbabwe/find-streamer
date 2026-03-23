import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  themePreference: 'find-streamer/theme-preference',
  recentSearches: 'find-streamer/recent-searches',
};

export async function loadThemePreference() {
  const value = await AsyncStorage.getItem(KEYS.themePreference);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export async function saveThemePreference(value) {
  await AsyncStorage.setItem(KEYS.themePreference, value);
}

export async function loadRecentSearches() {
  const raw = await AsyncStorage.getItem(KEYS.recentSearches);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveRecentSearches(items) {
  await AsyncStorage.setItem(KEYS.recentSearches, JSON.stringify(items.slice(0, 6)));
}
