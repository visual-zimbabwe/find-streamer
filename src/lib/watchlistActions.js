// @ts-check
import {
  isInUserLibrary,
  normalizeWatchlistItem,
  watchlistEntryKey,
} from './watchlistModel.js';

/** @typedef {import('./types.js').WatchlistItem} WatchlistItem */
/** @typedef {import('./types.js').WatchlistCollection} WatchlistCollection */
/** @typedef {import('./types.js').ResolvedDetailResult} ResolvedDetailResult */
/** @typedef {import('./types.js').SearchResult} SearchResult */

/**
 * Align a stored watchlist row's synopsis with what ResultView would show:
 * prefer a real TMDB synopsis, fall back to the OMDb plot, then the existing row.
 * Pure: returns a new row, never mutates the input.
 * @param {WatchlistItem} row
 * @param {ResolvedDetailResult} fullResult
 * @returns {WatchlistItem}
 */
export function mergeResolvedSynopsisIntoWatchlistRow(row, fullResult) {
  const nextSynopsis =
    fullResult.synopsis && fullResult.synopsis !== 'No synopsis available.'
      ? fullResult.synopsis
      : fullResult.omdbRatings?.plot || fullResult.synopsis || row.synopsis || '';
  return {
    ...row,
    synopsis: (nextSynopsis && String(nextSynopsis).trim()) || row.synopsis,
    ...(fullResult.omdbRatings ? { omdbRatings: fullResult.omdbRatings } : {}),
  };
}

/**
 * Adding a title to a new collection un-drops it (dropped -> saved) and appends
 * the collection id. Returns a normalized item.
 * @param {WatchlistItem} item
 * @param {WatchlistCollection} collection
 * @returns {WatchlistItem | null}
 */
export function applyCreateCollection(item, collection) {
  return normalizeWatchlistItem({
    ...item,
    status: item.status === 'dropped' ? 'saved' : item.status,
    collectionIds: [...(item.collectionIds || []), collection.id],
  });
}

/**
 * Toggle a collection membership for an item. Adding (when previously dropped)
 * un-drops it; the special `watched` collection is kept in sync with the item's
 * status. Returns a normalized item.
 * @param {WatchlistItem} item
 * @param {string} collectionId
 * @returns {WatchlistItem | null}
 */
export function applyToggleCollection(item, collectionId) {
  const selected = item.collectionIds?.includes(collectionId);
  let newStatus = item.status === 'dropped' ? 'saved' : item.status;
  if (collectionId === 'watched') {
    newStatus = selected ? 'saved' : 'watched';
  }
  return normalizeWatchlistItem({
    ...item,
    status: newStatus,
    collectionIds: selected
      ? (item.collectionIds || []).filter((id) => id !== collectionId)
      : [...(item.collectionIds || []), collectionId],
  });
}

/**
 * Set an item's status, keeping the special `watched` collection membership in
 * sync (added when watched, removed otherwise). Returns a normalized item.
 * @param {WatchlistItem} item
 * @param {import('./types.js').WatchlistStatus} status
 * @returns {WatchlistItem | null}
 */
export function applySetStatus(item, status) {
  let collectionIds = item.collectionIds || [];
  if (status === 'watched') {
    if (!collectionIds.includes('watched')) {
      collectionIds = [...collectionIds, 'watched'];
    }
  } else {
    collectionIds = collectionIds.filter((id) => id !== 'watched');
  }
  return normalizeWatchlistItem({ ...item, status, collectionIds });
}

/**
 * Resolve a bookmark toggle against the current watchlist. Pure: computes the
 * next list plus what happened, leaving persistence/UI to the caller.
 *
 * @param {WatchlistItem[]} watchlist
 * @param {SearchResult | ResolvedDetailResult | WatchlistItem} result
 * @returns {{ action: 'added'|'restored'|'exists', item: WatchlistItem | null, watchlist: WatchlistItem[] }}
 *   - `added`: brand new saved item prepended (deduped by entry key)
 *   - `restored`: a dropped item brought back to `saved`
 *   - `exists`: already in the library; list returned unchanged
 */
export function addOrRestoreItem(watchlist, result) {
  const key = watchlistEntryKey(result);
  const existing = key
    ? watchlist.find((item) => watchlistEntryKey(item) === key) || null
    : null;

  if (existing) {
    if (!isInUserLibrary(existing)) {
      const restoredItem = normalizeWatchlistItem({ ...existing, status: 'saved' });
      const nextWatchlist = watchlist.map((item) =>
        watchlistEntryKey(item) === watchlistEntryKey(restoredItem) ? restoredItem : item,
      );
      return { action: 'restored', item: restoredItem, watchlist: nextWatchlist };
    }
    return { action: 'exists', item: existing, watchlist };
  }

  const newItem = normalizeWatchlistItem({
    ...result,
    status: 'saved',
    collectionIds: [],
  });
  const nextWatchlist = [
    newItem,
    ...watchlist.filter((item) => watchlistEntryKey(item) !== watchlistEntryKey(newItem)),
  ];
  return { action: 'added', item: newItem, watchlist: nextWatchlist };
}

/**
 * Remove an item by entry key. Returns the same array reference (a no-op
 * sentinel the caller can detect with `===`) when nothing matched.
 * @param {WatchlistItem[]} watchlist
 * @param {string | null} key
 * @returns {WatchlistItem[]}
 */
export function removeItem(watchlist, key) {
  if (!key) return watchlist;
  const next = watchlist.filter((item) => watchlistEntryKey(item) !== key);
  return next.length === watchlist.length ? watchlist : next;
}

/**
 * Mark an item watched by entry key. Mirrors the lightweight in-place status
 * flip used by the row action (no normalization, no collection sync). Returns
 * the same array reference when the status was already `watched`.
 * @param {WatchlistItem[]} watchlist
 * @param {string | null} key
 * @returns {WatchlistItem[]}
 */
export function markItemWatched(watchlist, key) {
  if (!key) return watchlist;
  const next = watchlist.map((item) =>
    watchlistEntryKey(item) === key
      ? /** @type {WatchlistItem} */ ({ ...item, status: 'watched' })
      : item,
  );
  const changed = next.some(
    (item, index) =>
      watchlistEntryKey(item) === key && item.status !== watchlist[index]?.status,
  );
  return changed ? next : watchlist;
}
