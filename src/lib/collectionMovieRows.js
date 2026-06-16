import collectionMovies from '../../collection_movies.json';
import { buildCollectionRowsFromMovies } from './collectionRows';

export { buildCollectionRowsFromMovies };

export async function fetchStaticCollectionRows(limit = Infinity) {
  return buildCollectionRowsFromMovies(collectionMovies, limit);
}
