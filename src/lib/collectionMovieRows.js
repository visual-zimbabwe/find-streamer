import collectionMovies from '../../collection_movies.json';

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
    synopsis: 'No synopsis available.',
    posterUrl: imageUrl(TMDB_POSTER_BASE_URL, item.poster_path || collection.poster_path),
    backdropUrl: imageUrl(TMDB_BACKDROP_BASE_URL, collection.backdrop_path),
    ratingValue,
    rating,
    collectionId: collection.id,
    collectionName: collection.name || 'Movie Collection',
  };
}

export function buildCollectionRowsFromMovies(movies = collectionMovies, limit = Infinity) {
  const rowsByCollectionId = new Map();
  const movieIdsByCollectionId = new Map();

  for (const rawItem of movies) {
    const item = mapCollectionMovie(rawItem);
    if (!item) continue;

    if (!rowsByCollectionId.has(item.collectionId)) {
      rowsByCollectionId.set(item.collectionId, {
        id: item.collectionId,
        title: item.collectionName,
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
    .sort((a, b) => b.firstMovieRatingValue - a.firstMovieRatingValue);

  return Number.isFinite(limit) && limit > 0 ? rows.slice(0, limit) : rows;
}

export async function fetchStaticCollectionRows(limit = Infinity) {
  return buildCollectionRowsFromMovies(collectionMovies, limit);
}
