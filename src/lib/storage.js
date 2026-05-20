import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_WATCHLIST_CATEGORY_ID, WATCHLIST_CATEGORIES } from './watchlistCategories';
import { buildDefaultPrepopulatedWatchlist } from './defaultWatchlist';

const KEYS = {
  themePreference: 'find-streamer/theme-preference',
  recentSearches: 'find-streamer/recent-searches',
  recentViewed: 'find-streamer/recent-viewed',
  watchlist: 'find-streamer/watchlist',
  defaultWatchlistSeeded: 'find-streamer/default-watchlist-seeded',
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

export async function loadRecentViewed() {
  const raw = await AsyncStorage.getItem(KEYS.recentViewed);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.tmdbId && item?.title && item?.mediaType);
  } catch {
    return [];
  }
}

export async function saveRecentViewed(items) {
  const uniqueItems = [];
  const seen = new Set();
  (items || []).forEach((item) => {
    const key = `${item.mediaType}:${item.tmdbId}`;
    if (!item?.tmdbId || !item?.title || seen.has(key)) return;
    seen.add(key);
    uniqueItems.push({
      mediaType: item.mediaType,
      tmdbId: item.tmdbId,
      title: item.title,
      year: item.year || 'N/A',
      posterUrl: item.posterUrl || null,
      backdropUrl: item.backdropUrl || null,
      synopsis: item.synopsis || 'No synopsis available.',
      rating: item.rating || 'N/A',
      ratingValue: item.ratingValue || 0,
    });
  });
  await AsyncStorage.setItem(KEYS.recentViewed, JSON.stringify(uniqueItems.slice(0, 8)));
}

export async function loadWatchlist() {
  const raw = await AsyncStorage.getItem(KEYS.watchlist);
  if (!raw) {
    const defaults = buildDefaultPrepopulatedWatchlist();
    await AsyncStorage.multiSet([
      [KEYS.watchlist, JSON.stringify(defaults)],
      [KEYS.defaultWatchlistSeeded, 'true'],
    ]);
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seeded = await AsyncStorage.getItem(KEYS.defaultWatchlistSeeded);
    if (parsed.length === 0 && seeded !== 'true') {
      const defaults = buildDefaultPrepopulatedWatchlist();
      await AsyncStorage.multiSet([
        [KEYS.watchlist, JSON.stringify(defaults)],
        [KEYS.defaultWatchlistSeeded, 'true'],
      ]);
      return defaults;
    }

    const categoryIds = new Set(WATCHLIST_CATEGORIES.map((category) => category.id));
    return parsed.map((item) => ({
      ...item,
      watchlistCategoryId: categoryIds.has(item?.watchlistCategoryId)
        ? item.watchlistCategoryId
        : DEFAULT_WATCHLIST_CATEGORY_ID,
    }));
  } catch {
    return [];
  }
}

export async function saveWatchlist(items) {
  await AsyncStorage.setItem(KEYS.watchlist, JSON.stringify(items));
}
