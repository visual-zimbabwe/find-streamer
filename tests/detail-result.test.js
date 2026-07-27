import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DETAIL_RESOLVE_DEADLINE_MS,
  OPEN_DETAIL_DEBOUNCE_MS,
  isSeedResult,
  seedDetailResult,
} from '../src/lib/detailResult.js';

/** A discover / rail row, which is all the app has at the moment of the tap. */
const ROW = {
  mediaType: 'movie',
  tmdbId: 335984,
  title: 'Blade Runner 2049',
  year: '2017',
  synopsis: 'Young Blade Runner K discovers a long-buried secret.',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  backdropUrl: 'https://image.tmdb.org/t/p/original/backdrop.jpg',
  ratingValue: 7.573,
  releaseDate: '2017-10-04',
};

test('seedDetailResult carries every field the tapped row already had', () => {
  const seed = seedDetailResult('blade runner', ROW);

  assert.equal(seed.query, 'blade runner');
  assert.equal(seed.tmdbId, 335984);
  assert.equal(seed.mediaType, 'movie');
  assert.equal(seed.title, 'Blade Runner 2049');
  assert.equal(seed.year, '2017');
  assert.equal(seed.synopsis, ROW.synopsis);
  assert.equal(seed.posterUrl, ROW.posterUrl);
  assert.equal(seed.backdropUrl, ROW.backdropUrl);
});

test('seedDetailResult formats the score the row carried, so the TMDb badge paints at once', () => {
  assert.equal(seedDetailResult('q', ROW).rating, '7.6/10');
  assert.equal(seedDetailResult('q', { ...ROW, ratingValue: 0 }).rating, 'N/A');
  assert.equal(seedDetailResult('q', { ...ROW, ratingValue: undefined }).rating, 'N/A');
});

test('seedDetailResult leaves rows null, never an empty array', () => {
  // `hasAvailabilityData` is `Array.isArray(result.rows)`. An empty array would
  // render "Not free to stream anywhere right now" — a wrong answer — for the
  // length of the fetch.
  const seed = seedDetailResult('q', ROW);
  assert.equal(seed.rows, null);
  assert.equal(Array.isArray(seed.rows), false);
});

test('seedDetailResult is shape-complete, so no section sees an undefined it never expected', () => {
  const seed = seedDetailResult('q', ROW);
  const emptyArrays = [
    'seasons',
    'castPersons',
    'starringPersons',
    'writerPersons',
    'directorPersons',
    'composerPersons',
    'createdByPersons',
    'productionCompanies',
    'trailerCandidates',
    'providerSummary',
  ];
  emptyArrays.forEach((key) => {
    assert.ok(Array.isArray(seed[key]), `${key} should be an array`);
    assert.equal(seed[key].length, 0, `${key} should start empty`);
  });

  // Guarded by `hasValue`, which rejects 'N/A' — these must not read as content.
  assert.equal(seed.genres, 'N/A');
  assert.equal(seed.trailer, 'N/A');
  assert.equal(seed.imdbId, null);
  assert.equal(seed.titleLogo, null);
  assert.equal(seed.heroBackdropUrl, null);
  assert.equal(seed.collectionSeed, null);
  assert.equal(seed.omdbRatings, null);
  assert.equal(seed.isAdaptation, false);
});

test('seedDetailResult tolerates a row missing the optional fields', () => {
  const seed = seedDetailResult('q', { mediaType: 'tv', tmdbId: 1396, title: 'Breaking Bad' });
  assert.equal(seed.title, 'Breaking Bad');
  assert.equal(seed.rating, 'N/A');
  assert.equal(seed.posterUrl, undefined);
  assert.equal(seed.rows, null);
});

test('isSeedResult separates a provisional screen from a resolved one', () => {
  assert.equal(isSeedResult(seedDetailResult('q', ROW)), true);
  assert.equal(isSeedResult({ ...ROW, rows: [] }), false);
  assert.equal(isSeedResult(null), false);
  assert.equal(isSeedResult(undefined), false);
});

test('the open guard and the resolve deadline are ordered sanely', () => {
  // The guard has to swallow a double-tap without being long enough to refuse a
  // deliberate second navigation; the deadline has to bound five legs of
  // 12s-timeout-plus-two-retries without expiring during a normal open.
  assert.ok(OPEN_DETAIL_DEBOUNCE_MS >= 300 && OPEN_DETAIL_DEBOUNCE_MS <= 1000);
  assert.ok(DETAIL_RESOLVE_DEADLINE_MS > OPEN_DETAIL_DEBOUNCE_MS);
  assert.ok(DETAIL_RESOLVE_DEADLINE_MS <= 30000);
});
