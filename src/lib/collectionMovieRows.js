import rawCollectionMovies from '../../collection_movies.json';
import { buildCollectionRowsFromMovies } from './collectionRows';

export { buildCollectionRowsFromMovies };

const collectionMovies = Array.isArray(rawCollectionMovies)
  ? rawCollectionMovies
  : (rawCollectionMovies?.default && Array.isArray(rawCollectionMovies.default)
    ? rawCollectionMovies.default
    : []);

let cachedRows = null;

export function getStaticCollectionRows(limit = Infinity) {
  if (!cachedRows) {
    cachedRows = buildCollectionRowsFromMovies(collectionMovies);
  }
  return Number.isFinite(limit) && limit > 0 ? cachedRows.slice(0, limit) : cachedRows;
}

export async function fetchStaticCollectionRows(limit = Infinity) {
  return getStaticCollectionRows(limit);
}

