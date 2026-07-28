// @ts-check
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  IMDB_TOP_100_COLLECTION_IDS,
  isDefaultSeededItem,
  normalizeWatchlistCollections,
  normalizeWatchlistItems,
} from './watchlistModel.js';

/** @typedef {import('./types.js').WatchlistItem} WatchlistItem */
/** @typedef {import('./types.js').WatchlistCollection} WatchlistCollection */

const KEYS = {
  recentViewed: 'find-streamer/recent-viewed',
  watchlist: 'find-streamer/watchlist',
  watchlistChunks: 'find-streamer/watchlist/chunks',
  watchlistChunk: 'find-streamer/watchlist/chunk',
  watchlistCollections: 'find-streamer/watchlist/collections',
  watchlistRecentDestinations: 'find-streamer/watchlist/recent-destinations',
  defaultWatchlistSeeded: 'find-streamer/default-watchlist-seeded',
  watchlistImdbMigrated: 'find-streamer/watchlist-imdb-migrated',
  homeSpotlightCache: 'find-streamer/home-spotlight-cache',
};

const EMPTY_HOME_SPOTLIGHT_CACHE = { all: [], movie: [], tv: [] };

function normalizeHomeSpotlightCache(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_HOME_SPOTLIGHT_CACHE };
  return {
    all: Array.isArray(raw.all) ? raw.all : [],
    movie: Array.isArray(raw.movie) ? raw.movie : [],
    tv: Array.isArray(raw.tv) ? raw.tv : [],
  };
}

const WATCHLIST_CHUNK_SIZE = 25;
const WATCHLIST_SYNOPSIS_STORAGE_MAX = 480;

/** @type {Promise<unknown>} */
let watchlistSaveChain = Promise.resolve();

function compactWatchlistRowForStorage(item) {
  if (!item) return item;
  const compact = { ...item };
  delete compact.backdropUrl;
  const synopsis = compact.synopsis;
  if (typeof synopsis === 'string' && synopsis.length > WATCHLIST_SYNOPSIS_STORAGE_MAX) {
    compact.synopsis = synopsis.slice(0, WATCHLIST_SYNOPSIS_STORAGE_MAX);
  }
  return compact;
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

function isOnlyImdbCollectionMembership(collectionIds) {
  const ids = Array.isArray(collectionIds) ? collectionIds : [];
  if (ids.length === 0) return true;
  return ids.every((id) => IMDB_TOP_100_COLLECTION_IDS.has(id));
}

function stripImdbCollectionIds(collectionIds) {
  return (collectionIds || []).filter((id) => !IMDB_TOP_100_COLLECTION_IDS.has(id));
}

function shouldRemoveDefaultSeededRow(item) {
  return (
    isDefaultSeededItem(item) &&
    item.status === 'saved' &&
    isOnlyImdbCollectionMembership(item.collectionIds)
  );
}

async function migrateImdbFromPersistedWatchlist(items, storage) {
  const migratedFlag = await storage.getItem(KEYS.watchlistImdbMigrated);
  if (migratedFlag === 'true') {
    return normalizeWatchlistItems(items);
  }

  let changed = false;
  const kept = [];

  for (const rawItem of items) {
    if (shouldRemoveDefaultSeededRow(rawItem)) {
      changed = true;
      continue;
    }

    const strippedIds = stripImdbCollectionIds(rawItem.collectionIds);
    if (strippedIds.length !== (rawItem.collectionIds || []).length) {
      changed = true;
      kept.push({ ...rawItem, collectionIds: strippedIds });
    } else {
      kept.push(rawItem);
    }
  }

  const normalized = normalizeWatchlistItems(kept);
  await storage.setItem(KEYS.watchlistImdbMigrated, 'true');

  if (changed) {
    await writeWatchlistToStorage(normalized, storage);
  }

  return normalized;
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

export async function loadWatchlistCollections(storage = AsyncStorage) {
  try {
    const raw = await storage.getItem(KEYS.watchlistCollections);
    if (!raw) return [];
    return normalizeWatchlistCollections(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function saveWatchlistCollections(collections, storage = AsyncStorage) {
  const normalized = normalizeWatchlistCollections(collections);
  await storage.setItem(KEYS.watchlistCollections, JSON.stringify(normalized));
  return normalized;
}

const RECENT_DESTINATIONS_MAX = 4;

/**
 * Most-recently-used collection ids for the save sheet's "Recent" quick-pick
 * row. Newest first; capped. Returns [] on any parse/shape problem.
 * @returns {Promise<string[]>}
 */
export async function loadRecentDestinations(storage = AsyncStorage) {
  try {
    const raw = await storage.getItem(KEYS.watchlistRecentDestinations);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id) => typeof id === 'string' && id.trim())
      .slice(0, RECENT_DESTINATIONS_MAX);
  } catch {
    return [];
  }
}

export async function saveRecentDestinations(ids, storage = AsyncStorage) {
  const clean = (Array.isArray(ids) ? ids : [])
    .filter((id) => typeof id === 'string' && id.trim())
    .slice(0, RECENT_DESTINATIONS_MAX);
  await storage.setItem(KEYS.watchlistRecentDestinations, JSON.stringify(clean));
  return clean;
}

export async function loadWatchlist(storage = AsyncStorage) {
  let loaded = [];

  try {
    const chunked = await loadChunkedWatchlist(storage);
    if (chunked !== null) {
      loaded = chunked;
    } else {
      const raw = await storage.getItem(KEYS.watchlist);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          loaded = normalizeWatchlistItems(parsed);
        }
      }
    }
  } catch {
    return [];
  }

  try {
    return await migrateImdbFromPersistedWatchlist(loaded, storage);
  } catch {
    return normalizeWatchlistItems(loaded);
  }
}

async function writeWatchlistToStorage(items, storage) {
  const normalizedItems = normalizeWatchlistItems(items);
  const compactItems = normalizedItems.map(compactWatchlistRowForStorage);

  const chunks = [];
  for (let index = 0; index < compactItems.length; index += WATCHLIST_CHUNK_SIZE) {
    chunks.push(compactItems.slice(index, index + WATCHLIST_CHUNK_SIZE));
  }

  const previousChunkCount = Number.parseInt(await storage.getItem(KEYS.watchlistChunks), 10);
  const staleChunkKeys =
    Number.isInteger(previousChunkCount) && previousChunkCount > chunks.length
      ? Array.from({ length: previousChunkCount - chunks.length }, (_, offset) =>
          watchlistChunkKey(chunks.length + offset),
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

export async function saveWatchlist(items, storage = AsyncStorage) {
  const task = watchlistSaveChain.then(() => writeWatchlistToStorage(items, storage));
  watchlistSaveChain = task.catch(() => {});
  return task;
}

export async function loadHomeSpotlightCache(storage = AsyncStorage) {
  try {
    const raw = await storage.getItem(KEYS.homeSpotlightCache);
    if (!raw) return { ...EMPTY_HOME_SPOTLIGHT_CACHE };
    return normalizeHomeSpotlightCache(JSON.parse(raw));
  } catch {
    return { ...EMPTY_HOME_SPOTLIGHT_CACHE };
  }
}

export async function saveHomeSpotlightCache(cache, storage = AsyncStorage) {
  await storage.setItem(
    KEYS.homeSpotlightCache,
    JSON.stringify(normalizeHomeSpotlightCache(cache)),
  );
}
