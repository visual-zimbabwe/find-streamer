// @ts-check
import {
  DEFAULT_WATCHLIST_CATEGORY_ID,
  WATCHLIST_CATEGORIES,
  getWatchlistCategory,
} from './watchlistCategories.js';

/** @typedef {import('./types.js').WatchlistItem} WatchlistItem */
/** @typedef {import('./types.js').WatchlistCollection} WatchlistCollection */
/** @typedef {import('./types.js').WatchlistStatus} WatchlistStatus */

export const WATCHLIST_SCHEMA_VERSION = 2;

export const IMDB_TOP_100_MOVIES_COLLECTION_ID = 'imdb_top_100_movies';
export const IMDB_TOP_100_TV_COLLECTION_ID = 'imdb_top_100_tv_series';
export const HIGHLY_RECOMMEND_COLLECTION_ID = 'highly_recommend';

export const IMDB_TOP_100_COLLECTION_IDS = new Set([
  IMDB_TOP_100_MOVIES_COLLECTION_ID,
  IMDB_TOP_100_TV_COLLECTION_ID,
]);

export const WATCHLIST_STATUSES = [
  { id: 'saved', label: 'Saved', icon: 'bookmark-outline' },
  { id: 'watching', label: 'Watching', icon: 'play-circle-outline' },
  { id: 'watched', label: 'Watched', icon: 'checkmark-circle-outline' },
  { id: 'dropped', label: 'Removed', icon: 'archive-outline' },
];

export const DEFAULT_COLLECTIONS = [
  {
    id: IMDB_TOP_100_TV_COLLECTION_ID,
    name: 'IMDb Top 100 TV Series',
    description: 'A prepopulated IMDb TV series starter list.',
    icon: 'tv-outline',
    immutable: true,
    source: 'default',
  },
  {
    id: IMDB_TOP_100_MOVIES_COLLECTION_ID,
    name: 'IMDb Top 100 Movies',
    description: 'A prepopulated IMDb movie starter list.',
    icon: 'film-outline',
    immutable: true,
    source: 'default',
  },
];

export const LEGACY_COLLECTIONS = WATCHLIST_CATEGORIES.filter(
  (category) => !DEFAULT_COLLECTIONS.some((collection) => collection.id === category.id),
).map((category) => ({
  id: category.id,
  name: category.label,
  description: category.description,
  icon: category.icon,
  immutable: false,
  source: 'legacy',
}));

const VALID_STATUS_IDS = new Set(WATCHLIST_STATUSES.map((status) => status.id));
const VALID_CATEGORY_IDS = new Set(WATCHLIST_CATEGORIES.map((category) => category.id));
const BUILT_IN_COLLECTION_IDS = new Set([
  ...DEFAULT_COLLECTIONS.map((collection) => collection.id),
  ...LEGACY_COLLECTIONS.map((collection) => collection.id),
]);

/**
 * Stable identity for a library row: `"${mediaType}:${tmdbId}"`, or null when
 * the item is missing the fields that define identity.
 * @param {Partial<WatchlistItem> | null | undefined} item
 * @returns {string | null}
 */
export function watchlistEntryKey(item) {
  if (!item || item.tmdbId == null || !item.mediaType) return null;
  return `${item.mediaType}:${item.tmdbId}`;
}

export function isDefaultCollectionId(collectionId) {
  return IMDB_TOP_100_COLLECTION_IDS.has(collectionId);
}

export function isDefaultSeededItem(item) {
  if (!item) return false;
  if (item.source === 'IMDb Top 100 - Movies' || item.source === 'IMDb Top 100 - TV Series')
    return true;
  return (
    item.watchlistCategoryId === IMDB_TOP_100_MOVIES_COLLECTION_ID ||
    item.watchlistCategoryId === IMDB_TOP_100_TV_COLLECTION_ID
  );
}

export function getCatalogCollections() {
  return [...DEFAULT_COLLECTIONS];
}

export function getUserWatchlistCollections(customCollections = []) {
  return [...LEGACY_COLLECTIONS, ...normalizeWatchlistCollections(customCollections)];
}

/** @deprecated Use getUserWatchlistCollections for watchlist UI and library sheets. */
export function getAllWatchlistCollections(customCollections = []) {
  return getUserWatchlistCollections(customCollections);
}

export function getStatusLabel(statusId) {
  return (
    WATCHLIST_STATUSES.find((status) => status.id === statusId)?.label ||
    WATCHLIST_STATUSES[0].label
  );
}

function statusFromLegacyCategory(categoryId) {
  if (categoryId === 'watched') return 'watched';
  return 'saved';
}

function dedupeCollectionIds(ids) {
  const out = [];
  const seen = new Set();
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    if (typeof id !== 'string' || !id.trim()) return;
    const clean = id.trim();
    if (seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  });
  return out;
}

/**
 * Coerce an arbitrary object into a valid {@link WatchlistItem}, or return null
 * when it lacks the required identity/title fields.
 * @param {any} item
 * @returns {WatchlistItem | null}
 */
export function normalizeWatchlistItem(item) {
  if (!item || item.tmdbId == null || !item.mediaType || !item.title) return null;
  if (item.mediaType !== 'movie' && item.mediaType !== 'tv') return null;

  const watchlistCategoryId = VALID_CATEGORY_IDS.has(item.watchlistCategoryId)
    ? item.watchlistCategoryId
    : DEFAULT_WATCHLIST_CATEGORY_ID;
  const status = VALID_STATUS_IDS.has(item.status)
    ? item.status
    : statusFromLegacyCategory(watchlistCategoryId);
  const collectionIds = dedupeCollectionIds(item.collectionIds);
  if (!Array.isArray(item.collectionIds)) {
    if (
      watchlistCategoryId !== 'watched' &&
      BUILT_IN_COLLECTION_IDS.has(watchlistCategoryId) &&
      !IMDB_TOP_100_COLLECTION_IDS.has(watchlistCategoryId) &&
      !collectionIds.includes(watchlistCategoryId)
    ) {
      collectionIds.push(watchlistCategoryId);
    }
  }

  // ISO 639-1 original-language code (powers Discover's personalized Quick
  // Picks). Normalize a present value; leave a truly absent field absent so the
  // backfill can tell "never checked" (undefined) from "checked, none" ('').
  const normalizedLanguageCode =
    item.originalLanguageCode === undefined
      ? undefined
      : String(item.originalLanguageCode).toLowerCase().trim();

  return {
    ...item,
    mediaType: item.mediaType,
    title: String(item.title).trim(),
    watchlistCategoryId,
    watchlistCategoryLabel:
      item.watchlistCategoryLabel || getWatchlistCategory(watchlistCategoryId).label,
    status,
    collectionIds,
    ...(normalizedLanguageCode !== undefined
      ? { originalLanguageCode: normalizedLanguageCode }
      : {}),
    schemaVersion: WATCHLIST_SCHEMA_VERSION,
  };
}

/**
 * Normalize a list of raw rows, dropping invalids and de-duping by entry key.
 * @param {any[]} items
 * @returns {WatchlistItem[]}
 */
export function normalizeWatchlistItems(items) {
  if (!Array.isArray(items)) return [];

  const out = [];
  const seen = new Set();
  for (const rawItem of items) {
    const item = normalizeWatchlistItem(rawItem);
    const key = watchlistEntryKey(item);
    if (!item || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Normalize raw collection definitions into valid {@link WatchlistCollection}s,
 * skipping built-in ids and de-duping by id.
 * @param {any[]} collections
 * @returns {WatchlistCollection[]}
 */
export function normalizeWatchlistCollections(collections) {
  if (!Array.isArray(collections)) return [];

  const out = [];
  const seen = new Set(BUILT_IN_COLLECTION_IDS);
  for (const collection of collections) {
    if (!collection || typeof collection.name !== 'string' || !collection.name.trim()) continue;
    const id =
      typeof collection.id === 'string' && collection.id.trim()
        ? collection.id.trim()
        : `custom_${collection.name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(
      /** @type {WatchlistCollection} */ ({
        id,
        name: collection.name.trim(),
        description: typeof collection.description === 'string' ? collection.description : '',
        icon: typeof collection.icon === 'string' ? collection.icon : 'albums-outline',
        immutable: false,
        source: 'custom',
        createdAt: collection.createdAt || new Date().toISOString(),
      }),
    );
  }
  return out;
}

export function isInUserLibrary(item) {
  return item?.status !== 'dropped';
}

/**
 * True when a watchlist row belongs to a given built-in category/collection.
 * A built-in category is recorded both as `watchlistCategoryId` and (for most)
 * pushed into `collectionIds`, so check both.
 * @param {WatchlistItem} item
 * @param {string} collectionId
 * @returns {boolean}
 */
export function itemInCollection(item, collectionId) {
  if (!item) return false;
  if (item.watchlistCategoryId === collectionId) return true;
  return Array.isArray(item.collectionIds) && item.collectionIds.includes(collectionId);
}

/**
 * The most common original languages among the titles in a given collection
 * (default: Highly Recommend), most-frequent first. Powers Discover's
 * personalized language Quick Picks. Rows without a captured
 * `originalLanguageCode` are skipped (the backfill fills those in over time).
 *
 * @param {WatchlistItem[]} watchlist
 * @param {{ collectionId?: string, limit?: number }} [options]
 * @returns {string[]} ISO 639-1 codes, e.g. ['en', 'fr', 'ko']
 */
export function topWatchlistLanguages(
  watchlist,
  { collectionId = HIGHLY_RECOMMEND_COLLECTION_ID, limit = 8 } = {},
) {
  if (!Array.isArray(watchlist)) return [];

  const counts = new Map();
  for (const item of watchlist) {
    if (!itemInCollection(item, collectionId)) continue;
    const code =
      typeof item.originalLanguageCode === 'string'
        ? item.originalLanguageCode.toLowerCase().trim()
        : '';
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, limit))
    .map(([code]) => code);
}
