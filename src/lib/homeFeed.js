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
import {
  NOW_PLAYING_REGION,
  RAIL_FULL_LIMIT,
  RAIL_LIMIT,
  dedupeRailItems,
  interleaveByPopularity,
  interleaveByTrendingRank,
  selectNowPlaying,
} from './searchRails.js';
import { resolveRatingValue } from './ratings.js';

export {
  HOME_SPOTLIGHT_MAX,
  buildBundledSpotlightSeed,
  mediaFilterToScope,
  orderSpotlightCandidates,
  shuffleArray,
} from './homeSpotlightCore.js';

export const HOME_RAIL_LIMIT = RAIL_LIMIT;
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
  return [...items].sort((a, b) => resolveRatingValue(b) - resolveRatingValue(a));
}

async function appendFromTraktAndDiscover(pool, seen, scope) {
  const mediaTypes = scope === 'all' ? ['movie', 'tv'] : [scope];

  for (const mediaType of mediaTypes) {
    if (pool.length >= HOME_SPOTLIGHT_MAX) return pool;
    try {
      const raw = await fetchTraktTrending(mediaType, 18);
      const enriched = await enrichTraktItems(raw);
      appendUniqueSpotlight(
        pool,
        seen,
        orderSpotlightCandidates(enriched, scope),
        HOME_SPOTLIGHT_MAX,
      );
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

/**
 * TMDb popularity for both media types, interleaved and poster-filtered — the
 * fallback that keeps the trending rail populated when Trakt is unavailable (it
 * 403s on some networks). Carries no watchers/rank, so the caller renders it
 * under a source-neutral header rather than claiming it came from Trakt.
 */
async function fetchTmdbPopularRail(limit) {
  const perSide = Math.ceil(limit / 2) + 2;
  const [movies, shows] = await Promise.all([
    discoverTitles({ mediaType: 'movie', sortBy: 'popularity.desc', page: 1 }),
    discoverTitles({ mediaType: 'tv', sortBy: 'popularity.desc', page: 1 }),
  ]);

  const ordered = dedupeRailItems(
    interleaveByPopularity(
      (movies.results || []).slice(0, perSide),
      (shows.results || []).slice(0, perSide),
    ),
  );
  return ordered.filter((item) => item.posterUrl).slice(0, limit);
}

/**
 * The trending rail, resolved to `{ items, source }`.
 *
 * Trakt is tried first — its movie + TV lists interleaved by Trakt's own rank
 * and enriched (the enrichment is deliberately the *last* step and runs over a
 * small buffer, so a poster-less item never costs a detail request). But Trakt
 * 403s on some networks, and an empty Trakt rail used to mean an empty section;
 * so on a Trakt failure *or* an empty Trakt result we cascade to TMDb
 * popularity, mirroring what Discover already does. The `source` lets the caller
 * drop the Trakt-only chrome (rank, live-watcher badge) when the data isn't
 * actually Trakt's. Only a double outage resolves empty — and that throws, so
 * the rail shows its honest error/retry state instead of silently vanishing.
 */
export async function fetchHomeTraktTrendingRail(limit = HOME_RAIL_LIMIT) {
  // A couple spare per side absorbs the items that turn out to have no poster.
  const perSide = Math.ceil(limit / 2) + 2;
  try {
    const [moviesRaw, tvRaw] = await Promise.all([
      fetchTraktTrending('movie', perSide),
      fetchTraktTrending('tv', perSide),
    ]);
    const ordered = dedupeRailItems(interleaveByTrendingRank(moviesRaw || [], tvRaw || []));
    const enriched = await enrichTraktItems(ordered.slice(0, limit + 4));
    const items = enriched.filter((item) => item.posterUrl).slice(0, limit);
    if (items.length > 0) return { items, source: 'trakt' };
    // Trakt answered but nothing was usable → fall through to TMDb popularity.
  } catch {
    // Trakt failed (commonly 403) → TMDb popularity keeps the rail alive.
  }

  const items = await fetchTmdbPopularRail(limit);
  if (items.length === 0) {
    // Both sources dry (TMDb is the app's primary API, so this is a hard
    // outage): surface the error/retry state rather than a silent empty rail.
    throw new Error('Trending is unavailable right now.');
  }
  return { items, source: 'tmdb' };
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

/**
 * Theatrical listings for {@link NOW_PLAYING_REGION}, ordered by popularity
 * behind a vote-count floor. The rail is answering "what can I go see", so an
 * unvoted festival pickup with a 9.0 is not the right top result.
 */
export async function fetchHomeNowPlayingRail(limit = RAIL_LIMIT) {
  const list = await fetchNowPlayingMovies({ region: NOW_PLAYING_REGION });
  return selectNowPlaying(list, limit);
}

export async function fetchHomeCollectionRows() {
  return fetchTopMovieCollectionRows(20);
}

/**
 * The full list behind a rail's "See all". Same ordering rules as the rail —
 * it is the same list, just deeper — so the first ten entries match what the
 * user just tapped past.
 *
 * @param {'trakt-trending' | 'now-playing'} railId
 */
export async function fetchSearchRailFull(railId, limit = RAIL_FULL_LIMIT) {
  if (railId === 'now-playing') return fetchHomeNowPlayingRail(limit);
  return fetchHomeTraktTrendingRail(limit);
}
