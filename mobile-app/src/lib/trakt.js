// ─── Trakt API Client ─────────────────────────────────────────────────────────
//
// Register a FREE app at https://trakt.tv/oauth/applications/new to get your
// Client ID, then paste it below. The app only needs Read access.
//
const TRAKT_CLIENT_ID = 'e7246bfdab489b1f604eb6bfbed9518c7402a3476fad3edb50537228fde96ef9';
const TRAKT_BASE = 'https://api.trakt.tv';

// In-memory cache per "mediaType:limit" key — 6-hour TTL
const _cache = {};
const _cacheAt = {};
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function traktGet(pathname, params = {}) {
  const url = new URL(`${TRAKT_BASE}${pathname}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': TRAKT_CLIENT_ID,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Trakt API key. Add your Client ID in src/lib/trakt.js.');
    }
    throw new Error(`Trakt API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch trending movies or TV shows from Trakt.
 *
 * Returns: [{ mediaType, tmdbId, imdbId, title, year, watchers, trendingRank }]
 * Posters/backdrops are NOT included — call enrichTraktItems() from tmdb.js next.
 *
 * @param {'movie'|'tv'} mediaType
 * @param {number}       limit     Max items to return (default 20)
 */
export async function fetchTraktTrending(mediaType = 'movie', limit = 20) {
  const cacheKey = `${mediaType}:${limit}`;
  const now = Date.now();

  if (_cache[cacheKey] && now - _cacheAt[cacheKey] < CACHE_TTL) {
    return _cache[cacheKey];
  }

  const endpoint = mediaType === 'tv' ? '/shows/trending' : '/movies/trending';
  const data = await traktGet(endpoint, { limit });

  const items = (data || [])
    .filter((entry) => {
      const media = mediaType === 'tv' ? entry.show : entry.movie;
      return media?.ids?.tmdb; // must have a TMDB ID to enrich later
    })
    .map((entry, index) => {
      const media = mediaType === 'tv' ? entry.show : entry.movie;
      return {
        mediaType,
        tmdbId: media.ids.tmdb,
        imdbId: media.ids.imdb || null,
        title: media.title || '(Untitled)',
        year: media.year ? String(media.year) : 'N/A',
        watchers: entry.watchers || 0,
        trendingRank: index + 1,
      };
    });

  _cache[cacheKey] = items;
  _cacheAt[cacheKey] = now;
  return items;
}
