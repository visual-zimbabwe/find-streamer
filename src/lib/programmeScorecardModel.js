/**
 * Pure model and builder for ProgrammeScorecard.
 *
 * Normalizes multi-source ratings (TMDb, IMDb, Rotten Tomatoes, Metacritic)
 * into a consistent array of scorecard items with monochromatic typography labels,
 * cleansed score strings, URLs, and screen-reader accessibility labels.
 */

export function buildScorecardItems({
  tmdbRating,
  tmdbUrl,
  imdbRating,
  imdbUrl,
  rottenTomatoes,
  rottenTomatoesUrl,
  metascore,
  metacriticUrl,
  title = 'Title',
} = {}) {
  const items = [];

  if (tmdbRating != null && tmdbRating !== '' && tmdbRating !== 'N/A') {
    const cleanTmdb = String(tmdbRating).trim();
    if (cleanTmdb) {
      items.push({
        key: 'tmdb',
        label: 'TMDB',
        value: cleanTmdb,
        url: tmdbUrl || null,
        a11yLabel: `${title}, TMDb rating ${cleanTmdb} out of 10. Opens TMDb.`,
      });
    }
  }

  if (imdbRating != null && imdbRating !== '' && imdbRating !== 'N/A') {
    const cleanImdb = String(imdbRating).split('/')[0].trim();
    if (cleanImdb && cleanImdb !== 'N/A') {
      items.push({
        key: 'imdb',
        label: 'IMDB',
        value: cleanImdb,
        url: imdbUrl || null,
        a11yLabel: `${title}, IMDb rating ${cleanImdb} out of 10. Opens IMDb.`,
      });
    }
  }

  if (rottenTomatoes != null && rottenTomatoes !== '' && rottenTomatoes !== 'N/A') {
    const cleanRt = String(rottenTomatoes).replace('%', '').trim();
    if (cleanRt && cleanRt !== 'N/A') {
      items.push({
        key: 'rt',
        label: 'RT',
        value: `${cleanRt}%`,
        url: rottenTomatoesUrl || null,
        a11yLabel: `${title}, Rotten Tomatoes rating ${cleanRt} percent. Opens Rotten Tomatoes.`,
      });
    }
  }

  if (metascore != null && metascore !== '' && metascore !== 'N/A') {
    const cleanMeta = String(metascore).split('/')[0].trim();
    if (cleanMeta && cleanMeta !== 'N/A') {
      items.push({
        key: 'meta',
        label: 'METASCORE',
        value: cleanMeta,
        url: metacriticUrl || null,
        a11yLabel: `${title}, Metacritic rating ${cleanMeta} out of 100. Opens Metacritic.`,
      });
    }
  }

  return items;
}
