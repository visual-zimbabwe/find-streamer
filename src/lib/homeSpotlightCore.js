import { buildDefaultPrepopulatedMovieWatchlist } from './defaultMovieWatchlist.js';
import { buildDefaultPrepopulatedTvWatchlist } from './defaultWatchlist.js';
import {
  IMDB_TOP_100_MOVIES_COLLECTION_ID,
  IMDB_TOP_100_TV_COLLECTION_ID,
  isInUserLibrary,
} from './watchlistModel.js';

export const HOME_SPOTLIGHT_MAX = 6;

export function shuffleArray(items = []) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** @param {null | 'movie' | 'tv'} mediaFilter */
export function mediaFilterToScope(mediaFilter) {
  if (mediaFilter === 'movie' || mediaFilter === 'tv') return mediaFilter;
  return 'all';
}

function dedupeKey(item) {
  return `${item.mediaType || 'movie'}:${item.tmdbId}`;
}

function ratingValueFromItem(it) {
  if (typeof it.ratingValue === 'number') return it.ratingValue;
  return parseFloat(String(it.rating || '').split('/')[0]) || 0;
}

export function watchlistItemToSpotlight(it) {
  return {
    mediaType: it.mediaType || 'movie',
    tmdbId: it.tmdbId,
    title: it.title,
    year: it.year,
    synopsis: it.synopsis,
    posterUrl: it.posterUrl,
    backdropUrl: it.backdropUrl,
    ratingValue: ratingValueFromItem(it),
    rating: it.rating,
  };
}

function matchesScope(item, scope) {
  if (scope === 'all') return item.mediaType === 'movie' || item.mediaType === 'tv';
  return item.mediaType === scope;
}

/** Shuffled tier pool with movies ranked before TV when scope is mixed. */
export function orderSpotlightCandidates(items, scope) {
  const shuffled = shuffleArray(items.filter((it) => matchesScope(it, scope)));
  if (scope !== 'all') return shuffled;
  const movies = shuffled.filter((it) => it.mediaType === 'movie');
  const tv = shuffled.filter((it) => it.mediaType === 'tv');
  return [...movies, ...tv];
}

export function appendUniqueSpotlight(pool, seen, candidates, limit = HOME_SPOTLIGHT_MAX) {
  for (const it of candidates) {
    if (pool.length >= limit) break;
    if (!it?.tmdbId) continue;
    const k = dedupeKey(it);
    if (seen.has(k)) continue;
    seen.add(k);
    pool.push(it);
  }
  return pool;
}

export function collectWatchlistTier(watchlist, categoryId, scope) {
  const inCat = (watchlist || []).filter(
    (w) => w.collectionIds?.includes(categoryId) && isInUserLibrary(w),
  );
  return orderSpotlightCandidates(inCat.map(watchlistItemToSpotlight), scope);
}

function bundledImdbPool(scope) {
  const movies = buildDefaultPrepopulatedMovieWatchlist().map(watchlistItemToSpotlight);
  const tv = buildDefaultPrepopulatedTvWatchlist().map(watchlistItemToSpotlight);
  if (scope === 'movie') return movies;
  if (scope === 'tv') return tv;
  return [...movies, ...tv];
}

export function collectImdbTier(watchlist, scope) {
  const collectionIds =
    scope === 'movie'
      ? [IMDB_TOP_100_MOVIES_COLLECTION_ID]
      : scope === 'tv'
        ? [IMDB_TOP_100_TV_COLLECTION_ID]
        : [IMDB_TOP_100_MOVIES_COLLECTION_ID, IMDB_TOP_100_TV_COLLECTION_ID];

  const byKey = new Map();
  for (const it of bundledImdbPool(scope)) {
    byKey.set(dedupeKey(it), it);
  }

  for (const catId of collectionIds) {
    const inCat = (watchlist || []).filter(
      (w) => w.collectionIds?.includes(catId) && isInUserLibrary(w),
    );
    for (const raw of inCat) {
      const spotlight = watchlistItemToSpotlight(raw);
      if (!matchesScope(spotlight, scope)) continue;
      byKey.set(dedupeKey(spotlight), spotlight);
    }
  }

  return orderSpotlightCandidates([...byKey.values()], scope);
}

/** Synchronous cold-start seed from bundled IMDb catalogs. */
export function buildBundledSpotlightSeed(scope = 'all') {
  return collectImdbTier([], scope).slice(0, HOME_SPOTLIGHT_MAX);
}

export function buildSyncHomeSpotlight(watchlist = [], scope = 'all') {
  const seen = new Set();
  let pool = [];

  const syncTiers = [
    () => collectWatchlistTier(watchlist, 'watch_next', scope),
    () => collectWatchlistTier(watchlist, 'rewatch', scope),
    () => collectImdbTier(watchlist, scope),
  ];

  for (const getTier of syncTiers) {
    if (pool.length >= HOME_SPOTLIGHT_MAX) break;
    appendUniqueSpotlight(pool, seen, getTier(), HOME_SPOTLIGHT_MAX);
  }

  return pool.slice(0, HOME_SPOTLIGHT_MAX);
}
