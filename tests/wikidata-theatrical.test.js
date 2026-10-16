import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAJOR_THEATRICAL_DISTRIBUTOR_REGEX,
  STREAMING_ONLY_DISTRIBUTOR_REGEX,
  VALID_MPA_RATINGS,
  buildWikidataTheatricalSparql,
  parseWikidataTheatricalBindings,
} from '../src/lib/wikidataTheatrical.js';

test('buildWikidataTheatricalSparql constructs valid SPARQL query with numeric TMDB IDs', () => {
  const sparql = buildWikidataTheatricalSparql(['1423191', 1236045, 'bad_id', '']);
  assert.ok(sparql);
  assert.ok(sparql.includes('VALUES ?tmdbId { "1423191" "1236045" }'));
  assert.ok(sparql.includes('wdt:P4947 ?tmdbId'));
  assert.ok(sparql.includes('wdt:P14671 ?mpaCert'));
  assert.ok(sparql.includes('wdt:P1874 ?netflixId'));
});

test('buildWikidataTheatricalSparql returns null when given no valid numeric IDs', () => {
  assert.equal(buildWikidataTheatricalSparql([]), null);
  assert.equal(buildWikidataTheatricalSparql(['invalid', null]), null);
});

test('parseWikidataTheatricalBindings extracts all theatrical verification fields', () => {
  const bindings = [
    {
      tmdbId: { value: '1423191' },
      distributors: { value: 'Sony Pictures Motion Picture Group|InterCom' },
      networks: { value: '' },
      nfId: { value: '' },
      apId: { value: '' },
      dsId: { value: '' },
      mpa: { value: '55565' },
      boxOffice: { value: '320225000' },
      budget: { value: '75000000' },
      minPubDate: { value: '2026-09-15T00:00:00Z' },
    },
    {
      tmdbId: { value: '1236045' },
      distributors: { value: '' },
      networks: { value: '' },
      nfId: { value: '81757047' },
      apId: { value: '' },
      dsId: { value: '' },
      mpa: { value: '' },
      boxOffice: { value: '' },
      budget: { value: '' },
      minPubDate: { value: '2026-10-09T00:00:00Z' },
    },
  ];

  const map = parseWikidataTheatricalBindings(bindings);
  assert.equal(map.size, 2);

  const studioMovie = map.get('1423191');
  assert.ok(studioMovie);
  assert.deepEqual(studioMovie.distributors, ['Sony Pictures Motion Picture Group', 'InterCom']);
  assert.equal(studioMovie.mpaCert, '55565');
  assert.equal(studioMovie.budget, 75000000);
  assert.equal(studioMovie.boxOffice, 320225000);
  assert.equal(studioMovie.minPubYear, 2026);
  assert.equal(studioMovie.netflixId, null);

  const streamerMovie = map.get('1236045');
  assert.ok(streamerMovie);
  assert.equal(streamerMovie.netflixId, '81757047');
  assert.equal(streamerMovie.mpaCert, null);
  assert.deepEqual(streamerMovie.distributors, []);
});

test('parseWikidataTheatricalBindings tolerates malformed or empty bindings', () => {
  assert.equal(parseWikidataTheatricalBindings([]).size, 0);
  assert.equal(parseWikidataTheatricalBindings(null).size, 0);
  assert.equal(parseWikidataTheatricalBindings([{ tmdbId: null }]).size, 0);
});

test('distributor regexes accurately classify theatrical vs streaming-only distributors', () => {
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('Paramount Pictures'));
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('Universal Pictures'));
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('Sony Pictures Releasing'));
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('Warner Bros. Pictures'));
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('A24'));
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('Focus Features'));
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('20th Century Studios'));
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('Roadside Attractions'));
  assert.ok(MAJOR_THEATRICAL_DISTRIBUTOR_REGEX.test('Amazon MGM Studios'));

  assert.ok(STREAMING_ONLY_DISTRIBUTOR_REGEX.test('Netflix'));
  assert.ok(STREAMING_ONLY_DISTRIBUTOR_REGEX.test('Apple TV+'));
  assert.ok(STREAMING_ONLY_DISTRIBUTOR_REGEX.test('Apple TV'));
  assert.ok(STREAMING_ONLY_DISTRIBUTOR_REGEX.test('Disney+'));
  assert.ok(STREAMING_ONLY_DISTRIBUTOR_REGEX.test('Shudder'));
  assert.ok(!STREAMING_ONLY_DISTRIBUTOR_REGEX.test('Warner Bros. Pictures'));
});

test('VALID_MPA_RATINGS includes standard US ratings', () => {
  assert.ok(VALID_MPA_RATINGS.has('G'));
  assert.ok(VALID_MPA_RATINGS.has('PG'));
  assert.ok(VALID_MPA_RATINGS.has('PG-13'));
  assert.ok(VALID_MPA_RATINGS.has('R'));
  assert.ok(VALID_MPA_RATINGS.has('NC-17'));
  assert.ok(!VALID_MPA_RATINGS.has('NR'));
  assert.ok(!VALID_MPA_RATINGS.has('TV-MA'));
});
