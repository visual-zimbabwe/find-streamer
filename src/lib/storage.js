import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_WATCHLIST_CATEGORY_ID, WATCHLIST_CATEGORIES } from './watchlistCategories.js';
import { buildDefaultPrepopulatedWatchlist } from './defaultWatchlist.js';

const KEYS = {
  themePreference: 'find-streamer/theme-preference',
  recentSearches: 'find-streamer/recent-searches',
  recentViewed: 'find-streamer/recent-viewed',
  watchlist: 'find-streamer/watchlist',
  watchlistChunks: 'find-streamer/watchlist/chunks',
  watchlistChunk: 'find-streamer/watchlist/chunk',
  defaultWatchlistSeeded: 'find-streamer/default-watchlist-seeded',
};

const WATCHLIST_CHUNK_SIZE = 50;

function normalizeWatchlistItems(items) {
  if (!Array.isArray(items)) return [];

  const categoryIds = new Set(WATCHLIST_CATEGORIES.map((category) => category.id));
  return items.map((item) => {
    const watchlistCategoryId = categoryIds.has(item?.watchlistCategoryId)
      ? item.watchlistCategoryId
      : DEFAULT_WATCHLIST_CATEGORY_ID;

    return {
      ...item,
      watchlistCategoryId,
    };
  });
}

function watchlistChunkKey(index) {
  return `${KEYS.watchlistChunk}/${index}`;
}

async function getMany(storage, keys) {
  if (typeof storage.multiGet === 'function') {
    return storage.multiGet(keys);
  }

  return Promise.all(keys.map(async (key) => [key, await storage.getItem(key)]));
}

async function setMany(storage, entries) {
  if (typeof storage.multiSet === 'function') {
    await storage.multiSet(entries);
    return;
  }

  await Promise.all(entries.map(([key, value]) => storage.setItem(key, value)));
}

async function removeMany(storage, keys) {
  if (keys.length === 0) return;

  if (typeof storage.multiRemove === 'function') {
    await storage.multiRemove(keys);
    return;
  }

  if (typeof storage.removeItem === 'function') {
    await Promise.all(keys.map((key) => storage.removeItem(key)));
  }
}

async function loadChunkedWatchlist(storage) {
  const rawChunkCount = await storage.getItem(KEYS.watchlistChunks);
  if (rawChunkCount == null) return null;

  const chunkCount = Number.parseInt(rawChunkCount, 10);
  if (!Number.isInteger(chunkCount) || chunkCount < 0) return null;
  if (chunkCount === 0) return [];

  const chunkKeys = Array.from({ length: chunkCount }, (_, index) => watchlistChunkKey(index));
  const rows = await getMany(storage, chunkKeys);
  const items = [];

  for (const [, value] of rows) {
    if (!value) continue;
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) continue;
    items.push(...parsed);
  }

  return normalizeWatchlistItems(items);
}

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

export async function loadWatchlist(storage = AsyncStorage) {
  try {
    const chunked = await loadChunkedWatchlist(storage);
    if (chunked) return chunked;
  } catch {
    return [];
  }

  try {
    const raw = await storage.getItem(KEYS.watchlist);
    if (!raw) {
      return normalizeWatchlistItems(buildDefaultPrepopulatedWatchlist());
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return normalizeWatchlistItems(parsed);
  } catch {
    return [];
  }
}

export async function saveWatchlist(items, storage = AsyncStorage) {
  const normalizedItems = normalizeWatchlistItems(items);

  const chunks = [];
  for (let index = 0; index < normalizedItems.length; index += WATCHLIST_CHUNK_SIZE) {
    chunks.push(normalizedItems.slice(index, index + WATCHLIST_CHUNK_SIZE));
  }

  const previousChunkCount = Number.parseInt(await storage.getItem(KEYS.watchlistChunks), 10);
  const staleChunkKeys = Number.isInteger(previousChunkCount) && previousChunkCount > chunks.length
    ? Array.from(
      { length: previousChunkCount - chunks.length },
      (_, offset) => watchlistChunkKey(chunks.length + offset)
    )
    : [];

  const entries = chunks.map((chunk, index) => [watchlistChunkKey(index), JSON.stringify(chunk)]);
  entries.push(
    [KEYS.watchlistChunks, String(chunks.length)],
    [KEYS.defaultWatchlistSeeded, 'true'],
  );

  await setMany(storage, entries);
  await removeMany(storage, [KEYS.watchlist, ...staleChunkKeys]);

  return normalizedItems;
}
