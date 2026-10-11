// Pure collection-row grouping/sorting logic. Kept free of the bundled
// `collection_movies.json` import so it can be unit-tested under the Node test
// runner (which rejects JSON imports without an import attribute). The static
// dataset is wired in by collectionMovieRows.js.

const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/original';

function imageUrl(baseUrl, path) {
  return path ? `${baseUrl}${path}` : null;
}

function mapCollectionMovie(item) {
  const collection = item?.collection;
  if (!item?.id || !item?.title || !collection?.id) return null;

  const year = item.release_date ? item.release_date.slice(0, 4) : 'N/A';
  const ratingValue = typeof item.vote_average === 'number' ? item.vote_average : 0;
  const rating = ratingValue > 0 ? `${ratingValue.toFixed(1)}/10` : 'N/A';

  return {
    mediaType: 'movie',
    tmdbId: item.id,
    title: item.title,
    year,
    releaseDate: item.release_date || '',
    synopsis: 'No synopsis available.',
    posterUrl: imageUrl(TMDB_POSTER_BASE_URL, item.poster_path || collection.poster_path),
    backdropUrl: imageUrl(TMDB_BACKDROP_BASE_URL, collection.backdrop_path),
    ratingValue,
    rating,
    collectionId: collection.id,
    collectionName: collection.name || 'Movie Collection',
    collectionPosterPath: collection.poster_path || null,
    collectionBackdropPath: collection.backdrop_path || null,
  };
}

export function buildCollectionRowsFromMovies(movies = [], limit = Infinity) {
  const list = Array.isArray(movies)
    ? movies
    : (movies?.default && Array.isArray(movies.default) ? movies.default : []);
  const rowsByCollectionId = new Map();
  const movieIdsByCollectionId = new Map();

  for (const rawItem of list) {
    const item = mapCollectionMovie(rawItem);
    if (!item) continue;

    if (!rowsByCollectionId.has(item.collectionId)) {
      rowsByCollectionId.set(item.collectionId, {
        id: item.collectionId,
        title: item.collectionName,
        posterUrl: imageUrl(TMDB_POSTER_BASE_URL, item.collectionPosterPath || item.posterUrl),
        backdropUrl: imageUrl(TMDB_BACKDROP_BASE_URL, item.collectionBackdropPath),
        firstMovie: item,
        firstMovieRatingValue: item.ratingValue || 0,
        items: [],
      });
      movieIdsByCollectionId.set(item.collectionId, new Set());
    }

    const seenMovieIds = movieIdsByCollectionId.get(item.collectionId);
    if (seenMovieIds.has(item.tmdbId)) continue;

    seenMovieIds.add(item.tmdbId);
    rowsByCollectionId.get(item.collectionId).items.push(item);
  }

  const rows = [...rowsByCollectionId.values()]
    .filter((row) => row.items.length > 1)
    .map((row) => {
      // Sort movies chronologically within each collection
      row.items.sort((a, b) => (a.releaseDate || '').localeCompare(b.releaseDate || ''));
      row.firstMovie = row.items[0];
      row.firstMovieRatingValue = row.firstMovie?.ratingValue || 0;

      const ratedItems = row.items.filter((item) => item.ratingValue > 0);
      const totalScore = ratedItems.reduce((acc, curr) => acc + curr.ratingValue, 0);
      const avgRating = ratedItems.length > 0 ? totalScore / ratedItems.length : 0;
      row.avgRating = avgRating > 0 ? avgRating.toFixed(1) : 'N/A';
      row.avgRatingValue = avgRating;

      const validYears = row.items
        .map((item) => parseInt(item.year, 10))
        .filter((y) => !isNaN(y) && y > 1900);
      if (validYears.length > 0) {
        const minYear = Math.min(...validYears);
        const maxYear = Math.max(...validYears);
        row.yearSpan = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;
      } else {
        row.yearSpan = '';
      }

      row.hasArt = row.items.some((item) => item.posterUrl != null) || Boolean(row.posterUrl);
      return row;
    })
    .sort((a, b) => b.firstMovieRatingValue - a.firstMovieRatingValue);

  return Number.isFinite(limit) && limit > 0 ? rows.slice(0, limit) : rows;
}
