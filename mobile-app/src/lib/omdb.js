const OMDB_API_KEY = 'cd05d48b';
const OMDB_BASE = 'http://www.omdbapi.com/';

/**
 * Fetch ratings from OMDb for a given IMDB ID.
 * Returns an object with imdbRating, rottenTomatoes, metascore, and awards.
 * Any field that is unavailable / 'N/A' will be null.
 *
 * @param {string|null} imdbId  e.g. 'tt3896198'
 * @returns {Promise<{ imdbRating: string|null, rottenTomatoes: string|null, metascore: string|null, awards: string|null }>}
 */
export async function fetchOmdbRatings(imdbId) {
  const empty = { imdbRating: null, rottenTomatoes: null, metascore: null, awards: null };

  if (!imdbId) return empty;

  try {
    const url = `${OMDB_BASE}?i=${encodeURIComponent(imdbId)}&apikey=${OMDB_API_KEY}`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) return empty;

    const data = await response.json();
    if (data.Response === 'False') return empty;

    const imdbRating =
      data.imdbRating && data.imdbRating !== 'N/A' ? `${data.imdbRating}/10` : null;

    const metascore =
      data.Metascore && data.Metascore !== 'N/A' ? data.Metascore : null;

    const rottenTomatoes =
      (data.Ratings || []).find((r) => r.Source === 'Rotten Tomatoes')?.Value ?? null;

    const awards =
      data.Awards && data.Awards !== 'N/A' ? data.Awards : null;

    return { imdbRating, rottenTomatoes, metascore, awards };
  } catch {
    return empty;
  }
}
