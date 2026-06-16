import {
  normalizeWatchlistCollections,
  normalizeWatchlistItems,
  watchlistEntryKey,
  WATCHLIST_SCHEMA_VERSION,
} from './watchlistModel.js';

export const WATCHLIST_EXPORT_KIND = 'find-streamer-watchlist';
export const WATCHLIST_EXPORT_SCHEMA_VERSION = WATCHLIST_SCHEMA_VERSION;
export { watchlistEntryKey };

/**
 * Validates, dedupes by (mediaType, tmdbId), and normalizes category fields.
 * First occurrence wins when the same title appears more than once.
 */
export function normalizeImportedWatchlistItems(rawItems) {
  return normalizeWatchlistItems(rawItems);
}

/**
 * Merges `incoming` into `existing` without duplicate (mediaType, tmdbId) rows.
 * Existing rows keep their order and win on conflicts; new rows are appended.
 */
export function mergeWatchlistsNoDuplicates(existing, incoming) {
  const normalizedExisting = normalizeImportedWatchlistItems(
    Array.isArray(existing) ? existing : [],
  );
  const normalizedIncoming = normalizeImportedWatchlistItems(
    Array.isArray(incoming) ? incoming : [],
  );

  const keys = new Set(normalizedExisting.map(watchlistEntryKey).filter(Boolean));
  const merged = [...normalizedExisting];

  for (const item of normalizedIncoming) {
    const key = watchlistEntryKey(item);
    if (!key || keys.has(key)) continue;
    keys.add(key);
    merged.push(item);
  }

  return merged;
}

export function mergeCollectionsNoDuplicates(existing, incoming) {
  const normalizedExisting = normalizeWatchlistCollections(existing);
  const normalizedIncoming = normalizeWatchlistCollections(incoming);
  const ids = new Set(normalizedExisting.map((collection) => collection.id));
  const merged = [...normalizedExisting];

  for (const collection of normalizedIncoming) {
    if (ids.has(collection.id)) continue;
    ids.add(collection.id);
    merged.push(collection);
  }

  return merged;
}

export function buildWatchlistExportPayload(watchlist, collections = []) {
  return {
    schemaVersion: WATCHLIST_EXPORT_SCHEMA_VERSION,
    exportKind: WATCHLIST_EXPORT_KIND,
    exportedAt: new Date().toISOString(),
    items: normalizeWatchlistItems(watchlist),
    collections: normalizeWatchlistCollections(collections),
  };
}

export function stringifyWatchlistExport(watchlist, collections = []) {
  return JSON.stringify(buildWatchlistExportPayload(watchlist, collections), null, 2);
}

export function parseWatchlistImportJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }

  let rawItems;
  let rawCollections = [];
  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
    if (parsed.exportKind && parsed.exportKind !== WATCHLIST_EXPORT_KIND) {
      return { ok: false, error: 'This file is not a Trova watchlist export.' };
    }
    rawItems = parsed.items;
    rawCollections = parsed.collections;
  } else {
    return { ok: false, error: 'This file does not contain a watchlist array.' };
  }

  const items = normalizeImportedWatchlistItems(rawItems);
  const collections = normalizeWatchlistCollections(rawCollections);
  if (rawItems.length > 0 && items.length === 0) {
    return { ok: false, error: 'No valid watchlist entries were found in this file.' };
  }

  return { ok: true, items, collections };
}
