import {
  bumpOmdbSessionRequestCount,
  recordRateQuota429,
  recordRateQuotaFromResponse,
} from './apiRateQuota';

const OMDB_API_KEY = 'cd05d48b';
const OMDB_BASE = 'https://www.omdbapi.com/';
const EMPTY_OMDB_RATINGS = {
  imdbRating: null,
  rottenTomatoes: null,
  metascore: null,
  awards: null,
  rated: null,
  writer: null,
  actors: null,
  plot: null,
};
const _omdbRatingsCache = new Map();

/**
 * Fetch ratings from OMDb for a given IMDB ID.
 * Returns an object with imdbRating, rottenTomatoes, metascore, and awards.
 * Any field that is unavailable / 'N/A' will be null.
 *
 * @param {string|null} imdbId  e.g. 'tt3896198'
 * @returns {Promise<{ imdbRating: string|null, rottenTomatoes: string|null, metascore: string|null, awards: string|null }>}
 */
export async function fetchOmdbRatings(imdbId) {
  if (!imdbId) return EMPTY_OMDB_RATINGS;
  if (_omdbRatingsCache.has(imdbId)) return _omdbRatingsCache.get(imdbId);

  try {
    const url = `${OMDB_BASE}?i=${encodeURIComponent(imdbId)}&apikey=${OMDB_API_KEY}`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      if (response.status === 429) {
        recordRateQuota429('omdb', response);
      }
      return EMPTY_OMDB_RATINGS;
    }

    recordRateQuotaFromResponse('omdb', response);
    bumpOmdbSessionRequestCount();
    const data = await response.json();
    if (data.Response === 'False') return EMPTY_OMDB_RATINGS;

    const imdbRating =
      data.imdbRating && data.imdbRating !== 'N/A' ? `${data.imdbRating}/10` : null;

    const metascore = data.Metascore && data.Metascore !== 'N/A' ? data.Metascore : null;

    const rottenTomatoes =
      (data.Ratings || []).find((r) => r.Source === 'Rotten Tomatoes')?.Value ?? null;

    const awards = data.Awards && data.Awards !== 'N/A' ? data.Awards : null;

    const rated =
      data.Rated && data.Rated !== 'N/A' && data.Rated !== 'Not Rated' && data.Rated !== 'Unrated'
        ? data.Rated
        : null;

    const writer = data.Writer && data.Writer !== 'N/A' ? data.Writer : null;

    const actors = data.Actors && data.Actors !== 'N/A' ? data.Actors : null;

    const plot = data.Plot && data.Plot !== 'N/A' ? data.Plot : null;

    const ratings = { imdbRating, rottenTomatoes, metascore, awards, rated, writer, actors, plot };
    _omdbRatingsCache.set(imdbId, ratings);
    return ratings;
  } catch {
    return EMPTY_OMDB_RATINGS;
  }
}
