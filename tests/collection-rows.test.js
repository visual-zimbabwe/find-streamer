import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCollectionRowsFromMovies } from '../src/lib/collectionRows.js';

function movie(id, title, voteAverage, collectionId, collectionName) {
  return {
    id,
    title,
    vote_average: voteAverage,
    release_date: '2000-01-01',
    poster_path: `/${id}.jpg`,
    collection: { id: collectionId, name: collectionName, poster_path: `/c${collectionId}.jpg` },
  };
}

const sampleMovies = [
  movie(10, 'Alpha One', 7.0, 1, 'Alpha Collection'),
  movie(11, 'Alpha Two', 6.0, 1, 'Alpha Collection'),
  movie(20, 'Beta One', 8.5, 2, 'Beta Collection'),
  movie(21, 'Beta Two', 8.0, 2, 'Beta Collection'),
  movie(30, 'Lonely', 9.9, 3, 'Solo Collection'),
];

test('collections are grouped and sorted by the first movie rating, highest first', () => {
  const rows = buildCollectionRowsFromMovies(sampleMovies);

  // Solo Collection has a single movie → dropped (needs > 1 entry to be a row).
  assert.deepEqual(
    rows.map((row) => row.title),
    ['Beta Collection', 'Alpha Collection'],
  );
  assert.equal(rows[0].firstMovieRatingValue, 8.5);
  assert.equal(rows[1].firstMovieRatingValue, 7.0);
});

test('each collection row keeps its member movies and a representative first movie', () => {
  const rows = buildCollectionRowsFromMovies(sampleMovies);
  const beta = rows.find((row) => row.id === 2);

  assert.equal(beta.items.length, 2);
  assert.equal(beta.firstMovie.title, 'Beta One');
  assert.deepEqual(
    beta.items.map((item) => item.tmdbId),
    [20, 21],
  );
});

test('duplicate movie ids within a collection are de-duplicated', () => {
  const withDupe = [...sampleMovies, movie(20, 'Beta One (dupe)', 8.5, 2, 'Beta Collection')];
  const rows = buildCollectionRowsFromMovies(withDupe);
  const beta = rows.find((row) => row.id === 2);
  assert.equal(beta.items.length, 2, 'the repeated tmdbId is ignored');
});

test('the limit argument caps the number of returned collection rows', () => {
  const rows = buildCollectionRowsFromMovies(sampleMovies, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Beta Collection');
});
