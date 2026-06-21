import { fetchTraktTrending } from './trakt';
import {
  discoverTitles,
  enrichTraktItems,
  fetchNowPlayingMovies,
  fetchTopMovieCollectionRows,
} from './tmdb';
import {
  HOME_SPOTLIGHT_MAX,
  appendUniqueSpotlight,
  buildSyncHomeSpotlight,
  orderSpotlightCandidates,
} from './homeSpotlightCore.js';

export {
  HOME_SPOTLIGHT_MAX,
  buildBundledSpotlightSeed,
  mediaFilterToScope,
  orderSpotlightCandidates,
  shuffleArray,
} from './homeSpotlightCore.js';

export const HOME_RAIL_LIMIT = 10;
export const HOME_HERO_ROTATION_MS = 8000;
export const HOME_HERO_RESUME_DELAY_MS = 3200;

export const HOME_SPOTLIGHT_SCOPES = ['all', 'movie', 'tv'];

/** Curated genre rails — one Movie + one TV rail per popular TMDb genre, English‑first. */
export const HOME_TMDB_RAILS = [
  {
    id: 'action_movies',
    title: 'Action movies',
    mediaType: 'movie',
    genreIds: [28],
    languageCodes: ['en'],
  },
  {
    id: 'action_tv',
    title: 'Action & adventure TV',
    mediaType: 'tv',
    genreIds: [10759],
    languageCodes: ['en'],
  },
  {
    id: 'drama_movies',
    title: 'Drama movies',
    mediaType: 'movie',
    genreIds: [18],
    languageCodes: ['en'],
  },
  { id: 'drama_tv', title: 'Drama series', mediaType: 'tv', genreIds: [18], languageCodes: ['en'] },
  {
    id: 'comedy_movies',
    title: 'Comedy movies',
    mediaType: 'movie',
    genreIds: [35],
    languageCodes: ['en'],
  },
  {
    id: 'comedy_tv',
    title: 'Comedy series',
    mediaType: 'tv',
    genreIds: [35],
    languageCodes: ['en'],
  },
  {
    id: 'thriller_movies',
    title: 'Thriller movies',
    mediaType: 'movie',
    genreIds: [53],
    languageCodes: ['en'],
  },
  { id: 'crime_tv', title: 'Crime series', mediaType: 'tv', genreIds: [80], languageCodes: ['en'] },
  {
    id: 'scifi_movies',
    title: 'Sci‑Fi movies',
    mediaType: 'movie',
    genreIds: [878],
    languageCodes: ['en'],
  },
  {
    id: 'scifi_tv',
    title: 'Sci‑Fi & fantasy TV',
    mediaType: 'tv',
    genreIds: [10765],
    languageCodes: ['en'],
  },
  {
    id: 'horror_movies',
    title: 'Horror movies',
    mediaType: 'movie',
    genreIds: [27],
    languageCodes: ['en'],
  },
  {
    id: 'horror_tv',
    title: 'Horror & thriller TV',
    mediaType: 'tv',
    genreIds: [9648],
    languageCodes: ['en'],
  },
  {
    id: 'crime_movies',
    title: 'Crime movies',
    mediaType: 'movie',
    genreIds: [80],
    languageCodes: ['en'],
  },
  {
    id: 'mystery_tv',
    title: 'Mystery & thriller TV',
    mediaType: 'tv',
    genreIds: [10765, 9648],
    languageCodes: ['en'],
  },
];

function dedupeKey(item) {
  return `${item.mediaType || 'movie'}:${item.tmdbId}`;
}

function sortByTmdbRatingDesc(items) {
  return [...items].sort((a, b) => (b.ratingValue || 0) - (a.ratingValue || 0));
}

function takeUniqueTop(items, limit) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it?.tmdbId) continue;
    const k = dedupeKey(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

async function appendFromTraktAndDiscover(pool, seen, scope) {
  const mediaTypes = scope === 'all' ? ['movie', 'tv'] : [scope];

  for (const mediaType of mediaTypes) {
    if (pool.length >= HOME_SPOTLIGHT_MAX) return pool;
    try {
      const raw = await fetchTraktTrending(mediaType, 18);
      const enriched = await enrichTraktItems(raw);
      appendUniqueSpotlight(pool, seen, orderSpotlightCandidates(enriched, scope), HOME_SPOTLIGHT_MAX);
    } catch {
      // Trakt enrichment is best-effort.
    }
  }

  for (const mediaType of mediaTypes) {
    if (pool.length >= HOME_SPOTLIGHT_MAX) return pool;
    try {
      const { results } = await discoverTitles({
        mediaType,
        languageCodes: ['en'],
        sortBy: 'vote_average.desc',
        page: 1,
      });
      appendUniqueSpotlight(
        pool,
        seen,
        orderSpotlightCandidates(sortByTmdbRatingDesc(results), scope),
        HOME_SPOTLIGHT_MAX,
      );
    } catch {
      // TMDB discover is best-effort.
    }
  }

  return pool;
}

/**
 * Build up to HOME_SPOTLIGHT_MAX spotlight items for a scope:
 * Watch Next → Rewatch → IMDb Top 100 → Trakt → TMDB discover.
 *
 * @param {import('./types.js').WatchlistItem[]} watchlist
 * @param {'all' | 'movie' | 'tv'} [scope]
 */
export async function buildHomeSpotlight(watchlist = [], scope = 'all') {
  const seen = new Set();
  const pool = buildSyncHomeSpotlight(watchlist, scope);
  for (const it of pool) {
    seen.add(dedupeKey(it));
  }

  if (pool.length < HOME_SPOTLIGHT_MAX) {
    await appendFromTraktAndDiscover(pool, seen, scope);
  }

  return pool.slice(0, HOME_SPOTLIGHT_MAX);
}

/** Trakt movie + TV trending, enriched, sorted by TMDB rating, unique, top HOME_RAIL_LIMIT. */
export async function fetchHomeTraktTrendingRail() {
  const [moviesRaw, tvRaw] = await Promise.all([
    fetchTraktTrending('movie', 16),
    fetchTraktTrending('tv', 16),
  ]);
  const enriched = await enrichTraktItems([...(moviesRaw || []), ...(tvRaw || [])]);
  const sorted = sortByTmdbRatingDesc(enriched);
  return takeUniqueTop(sorted, HOME_RAIL_LIMIT);
}

export async function fetchHomeTmdbRail(def) {
  const { results } = await discoverTitles({
    mediaType: def.mediaType,
    genreIds: def.genreIds,
    languageCodes: def.languageCodes || [],
    sortBy: 'vote_average.desc',
    page: 1,
  });
  return sortByTmdbRatingDesc(results).slice(0, HOME_RAIL_LIMIT);
}

export async function fetchHomeNowPlayingRail() {
  const list = await fetchNowPlayingMovies();
  return sortByTmdbRatingDesc(list).slice(0, HOME_RAIL_LIMIT);
}

export async function fetchHomeCollectionRows() {
  return fetchTopMovieCollectionRows(20);
}
