import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScorecardItems } from '../src/lib/programmeScorecardModel.js';

test('buildScorecardItems formats all 4 rating services correctly', () => {
  const items = buildScorecardItems({
    tmdbRating: '7.8',
    tmdbUrl: 'https://www.themoviedb.org/movie/123',
    imdbRating: '8.2/10',
    imdbUrl: 'https://www.imdb.com/title/tt123/',
    rottenTomatoes: '84%',
    rottenTomatoesUrl: 'https://www.rottentomatoes.com/m/test',
    metascore: '76',
    metacriticUrl: 'https://www.metacritic.com/movie/test',
    title: 'The Dark Knight',
  });

  assert.equal(items.length, 4);

  assert.deepEqual(items[0], {
    key: 'tmdb',
    label: 'TMDB',
    value: '7.8',
    url: 'https://www.themoviedb.org/movie/123',
    a11yLabel: 'The Dark Knight, TMDb rating 7.8 out of 10. Opens TMDb.',
  });

  assert.deepEqual(items[1], {
    key: 'imdb',
    label: 'IMDB',
    value: '8.2',
    url: 'https://www.imdb.com/title/tt123/',
    a11yLabel: 'The Dark Knight, IMDb rating 8.2 out of 10. Opens IMDb.',
  });

  assert.deepEqual(items[2], {
    key: 'rt',
    label: 'RT',
    value: '84%',
    url: 'https://www.rottentomatoes.com/m/test',
    a11yLabel: 'The Dark Knight, Rotten Tomatoes rating 84 percent. Opens Rotten Tomatoes.',
  });

  assert.deepEqual(items[3], {
    key: 'meta',
    label: 'METASCORE',
    value: '76',
    url: 'https://www.metacritic.com/movie/test',
    a11yLabel: 'The Dark Knight, Metacritic rating 76 out of 100. Opens Metacritic.',
  });
});

test('buildScorecardItems skips missing or empty ratings', () => {
  const items = buildScorecardItems({
    tmdbRating: '7.2',
    tmdbUrl: 'https://tmdb',
    imdbRating: null,
    rottenTomatoes: '',
    metascore: 'N/A',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].key, 'tmdb');
  assert.equal(items[0].value, '7.2');
});

test('buildScorecardItems returns empty array when all inputs are empty or null', () => {
  const items = buildScorecardItems();
  assert.deepEqual(items, []);
});
