import { DEFAULT_WATCHLIST_CATEGORY_ID, WATCHLIST_CATEGORIES, getWatchlistCategory } from './watchlistCategories.js';

export const WATCHLIST_EXPORT_KIND = 'find-streamer-watchlist';
export const WATCHLIST_EXPORT_SCHEMA_VERSION = 1;

/** Stable key for movie vs TV with the same TMDB numeric id. */
export function watchlistEntryKey(item) {
  if (!item || item.tmdbId == null || !item.mediaType) return null;
  return `${item.mediaType}:${item.tmdbId}`;
}

/**
 * Validates, dedupes by (mediaType, tmdbId), and normalizes category fields.
 * First occurrence wins when the same title appears more than once.
 */
export function normalizeImportedWatchlistItems(rawItems) {
  const categoryIds = new Set(WATCHLIST_CATEGORIES.map((c) => c.id));
  if (!Array.isArray(rawItems)) return [];

  const out = [];
  const seenKeys = new Set();

  for (const item of rawItems) {
    if (!item || item.tmdbId == null || typeof item.title !== 'string' || !item.title.trim()) continue;
    const mediaType = item.mediaType === 'tv' || item.mediaType === 'movie' ? item.mediaType : null;
    if (!mediaType) continue;

    const key = `${mediaType}:${item.tmdbId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const watchlistCategoryId = categoryIds.has(item?.watchlistCategoryId)
      ? item.watchlistCategoryId
      : DEFAULT_WATCHLIST_CATEGORY_ID;

    out.push({
      ...item,
      mediaType,
      title: item.title.trim(),
      watchlistCategoryId,
      watchlistCategoryLabel: getWatchlistCategory(watchlistCategoryId).label,
    });
  }

  return out;
}

/**
 * Merges `incoming` into `existing` without duplicate (mediaType, tmdbId) rows.
 * Existing rows keep their order and win on conflicts; new rows are appended.
 */
export function mergeWatchlistsNoDuplicates(existing, incoming) {
  const normalizedExisting = normalizeImportedWatchlistItems(Array.isArray(existing) ? existing : []);
  const normalizedIncoming = normalizeImportedWatchlistItems(Array.isArray(incoming) ? incoming : []);

  const keys = new Set(
    normalizedExisting.map(watchlistEntryKey).filter(Boolean)
  );
  const merged = [...normalizedExisting];

  for (const item of normalizedIncoming) {
    const key = watchlistEntryKey(item);
    if (!key || keys.has(key)) continue;
    keys.add(key);
    merged.push(item);
  }

  return merged;
}

export function buildWatchlistExportPayload(watchlist) {
  return {
    schemaVersion: WATCHLIST_EXPORT_SCHEMA_VERSION,
    exportKind: WATCHLIST_EXPORT_KIND,
    exportedAt: new Date().toISOString(),
    items: Array.isArray(watchlist) ? watchlist : [],
  };
}

export function stringifyWatchlistExport(watchlist) {
  return JSON.stringify(buildWatchlistExportPayload(watchlist), null, 2);
}

export function parseWatchlistImportJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }

  let rawItems;
  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
    if (parsed.exportKind && parsed.exportKind !== WATCHLIST_EXPORT_KIND) {
      return { ok: false, error: 'This file is not a Trova watchlist export.' };
    }
    rawItems = parsed.items;
  } else {
    return { ok: false, error: 'This file does not contain a watchlist array.' };
  }

  const items = normalizeImportedWatchlistItems(rawItems);
  if (rawItems.length > 0 && items.length === 0) {
    return { ok: false, error: 'No valid watchlist entries were found in this file.' };
  }

  return { ok: true, items };
}
