import { fetchTraktTrending } from './trakt';
import { discoverTitles, enrichTraktItems, fetchNowPlayingMovies } from './tmdb';
import { getWatchlistCategory } from './watchlistCategories';

export const HOME_RAIL_LIMIT = 10;
export const HOME_SPOTLIGHT_MAX = 6;
export const HOME_HERO_ROTATION_MS = 7000;
export const HOME_HERO_RESUME_DELAY_MS = 3200;

const SPOTLIGHT_CATEGORY_ORDER = [
  'watch_next',
  'highly_recommend',
  'rewatch',
  'maybe_later',
  'watched',
];

/** Curated discover rows: TMDB vote_average.desc, top HOME_RAIL_LIMIT client-side. */
export const HOME_TMDB_RAILS = [
  { id: 'sci_fi_movies', title: 'Sci‑Fi standouts', mediaType: 'movie', genreIds: [878] },
  { id: 'drama_movies', title: 'Drama picks', mediaType: 'movie', genreIds: [18] },
  { id: 'thriller_movies', title: 'Thriller night', mediaType: 'movie', genreIds: [53] },
  { id: 'comedy_movies', title: 'Comedy favorites', mediaType: 'movie', genreIds: [35] },
  { id: 'tv_drama', title: 'TV drama', mediaType: 'tv', genreIds: [18] },
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

/**
 * Build up to HOME_SPOTLIGHT_MAX items: watchlist (priority categories) → Trakt movies → Trakt TV → TMDB top-rated movies.
 */
export async function buildHomeSpotlight(watchlist = []) {
  const pool = [];
  const seen = new Set();

  for (const catId of SPOTLIGHT_CATEGORY_ORDER) {
    const inCat = (watchlist || []).filter(
      (w) => getWatchlistCategory(w.watchlistCategoryId).id === catId
    );
    for (const it of inCat) {
      const k = dedupeKey(it);
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push({
        mediaType: it.mediaType || 'movie',
        tmdbId: it.tmdbId,
        title: it.title,
        year: it.year,
        synopsis: it.synopsis,
        posterUrl: it.posterUrl,
        backdropUrl: it.backdropUrl,
        ratingValue: typeof it.ratingValue === 'number' ? it.ratingValue : parseFloat(String(it.rating || '').split('/')[0]) || 0,
        rating: it.rating,
      });
      if (pool.length >= HOME_SPOTLIGHT_MAX) return pool;
    }
  }

  async function appendFromTrakt(mediaType) {
    if (pool.length >= HOME_SPOTLIGHT_MAX) return;
    const raw = await fetchTraktTrending(mediaType, 18);
    const enriched = await enrichTraktItems(raw);
    const sorted = sortByTmdbRatingDesc(enriched);
    for (const it of sorted) {
      const k = dedupeKey(it);
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push(it);
      if (pool.length >= HOME_SPOTLIGHT_MAX) return;
    }
  }

  await appendFromTrakt('movie');
  await appendFromTrakt('tv');

  if (pool.length < HOME_SPOTLIGHT_MAX) {
    const { results } = await discoverTitles({
      mediaType: 'movie',
      sortBy: 'vote_average.desc',
      page: 1,
    });
    const sorted = sortByTmdbRatingDesc(results);
    for (const it of sorted) {
      const k = dedupeKey(it);
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push(it);
      if (pool.length >= HOME_SPOTLIGHT_MAX) return pool;
    }
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
    sortBy: 'vote_average.desc',
    page: 1,
  });
  return sortByTmdbRatingDesc(results).slice(0, HOME_RAIL_LIMIT);
}

export async function fetchHomeNowPlayingRail() {
  const list = await fetchNowPlayingMovies();
  return sortByTmdbRatingDesc(list).slice(0, HOME_RAIL_LIMIT);
}
