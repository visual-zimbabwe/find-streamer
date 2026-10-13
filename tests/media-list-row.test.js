import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMediaRowMeta,
  formatMediaRowAccessibilityLabel,
  resolveMediaRowItemProps,
  initialsForName,
} from '../src/lib/mediaRowModel.js';

test('initialsForName extracts up to 2 uppercase initials correctly', () => {
  assert.equal(initialsForName('Christopher Nolan'), 'CN');
  assert.equal(initialsForName('Zendaya'), 'Z');
  assert.equal(initialsForName('Robert Downey Jr.'), 'RD');
  assert.equal(initialsForName(''), '?');
  assert.equal(initialsForName(null), '?');
});

test('formatMediaRowMeta formats movie and TV title metadata', () => {
  assert.equal(formatMediaRowMeta({ year: 2024, mediaType: 'movie' }), '2024 · Movie');
  assert.equal(formatMediaRowMeta({ year: 2023, mediaType: 'tv' }), '2023 · TV Show');
  assert.equal(formatMediaRowMeta({ year: 'N/A', mediaType: 'movie' }), 'Movie');
  assert.equal(formatMediaRowMeta({ year: 1994, mediaType: null }), '1994');
});

test('formatMediaRowMeta formats person metadata', () => {
  assert.equal(
    formatMediaRowMeta({
      resultType: 'person',
      departmentLabel: 'Directing',
      knownFor: 'Inception',
    }),
    'Directing · Inception',
  );
  assert.equal(
    formatMediaRowMeta({
      resultType: 'person',
      departmentLabel: 'Acting',
    }),
    'Acting',
  );
  assert.equal(
    formatMediaRowMeta({
      name: 'Leonardo DiCaprio',
      roleLabel: 'Cobb',
    }),
    'Cobb',
  );
  assert.equal(
    formatMediaRowMeta({
      year: 2010,
      character: 'Dom Cobb',
    }),
    '2010 · as Dom Cobb',
  );
});

test('formatMediaRowAccessibilityLabel produces accurate screen reader labels', () => {
  assert.equal(
    formatMediaRowAccessibilityLabel({ title: 'The Godfather' }, { rank: 1 }),
    'Open details for The Godfather, ranked 1',
  );
  assert.equal(
    formatMediaRowAccessibilityLabel({ title: 'Interstellar', year: 2014 }),
    'Interstellar, 2014. Open details.',
  );
  assert.equal(
    formatMediaRowAccessibilityLabel(
      { name: 'Cillian Murphy', roleLabel: 'J. Robert Oppenheimer' },
      { canPeek: true },
    ),
    'Cillian Murphy, J. Robert Oppenheimer. View filmography. Hold for a quick filmography preview',
  );
  assert.equal(
    formatMediaRowAccessibilityLabel(
      { title: 'Denis Villeneuve', departmentLabel: 'Directing', resultType: 'person' },
      { canPeek: false },
    ),
    'Denis Villeneuve, Directing. View filmography',
  );
});

test('resolveMediaRowItemProps resolves search candidate and person items', () => {
  const person = {
    resultType: 'person',
    title: 'Greta Gerwig',
    profileUrl: 'https://image.tmdb.org/t/p/w185/greta.jpg',
    departmentLabel: 'Directing',
    knownFor: 'Barbie',
  };
  const resolvedPerson = resolveMediaRowItemProps(person);
  assert.equal(resolvedPerson.title, 'Greta Gerwig');
  assert.equal(resolvedPerson.meta, 'Directing · Barbie');
  assert.equal(resolvedPerson.imageUri, 'https://image.tmdb.org/t/p/w185/greta.jpg');
  assert.equal(resolvedPerson.imageVariant, 'avatar');
  assert.equal(resolvedPerson.fallbackIcon, 'person-outline');

  const movie = {
    title: 'Oppenheimer',
    year: 2023,
    mediaType: 'movie',
    posterUrl: 'https://image.tmdb.org/t/p/w500/oppenheimer.jpg',
  };
  const resolvedMovie = resolveMediaRowItemProps(movie);
  assert.equal(resolvedMovie.title, 'Oppenheimer');
  assert.equal(resolvedMovie.meta, '2023 · Movie');
  assert.equal(resolvedMovie.imageUri, 'https://image.tmdb.org/t/p/w500/oppenheimer.jpg');
  assert.equal(resolvedMovie.imageVariant, 'poster');
  assert.equal(resolvedMovie.fallbackIcon, 'film-outline');
});
