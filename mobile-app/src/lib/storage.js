import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  themePreference: 'find-streamer/theme-preference',
  recentSearches: 'find-streamer/recent-searches',
  watchlist: 'find-streamer/watchlist',
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
  // Keep only the last 3 unique searches
  const uniqueItems = Array.from(new Set(items)).slice(0, 3);
  await AsyncStorage.setItem(KEYS.recentSearches, JSON.stringify(uniqueItems));
}

export async function loadWatchlist() {
  const raw = await AsyncStorage.getItem(KEYS.watchlist);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveWatchlist(items) {
  await AsyncStorage.setItem(KEYS.watchlist, JSON.stringify(items));
}
