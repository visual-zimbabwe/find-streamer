import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCollectionRows,
  rowMatchesSize,
  rowMatchesDecade,
  countActiveFindBadge,
  findRowIndexForLetter,
  getLibraryCollectionIds,
} from '../src/lib/collectionFilters.js';

const sampleRows = [
  {
    id: 1,
    title: 'Star Wars Collection',
    firstMovieRatingValue: 8.2,
    items: [
      { mediaType: 'movie', tmdbId: 11, year: '1977' },
      { mediaType: 'movie', tmdbId: 1891, year: '1980' },
    ],
  },
  {
    id: 2,
    title: 'Alien Collection',
    firstMovieRatingValue: 7.5,
    items: [
      { mediaType: 'movie', tmdbId: 348, year: '1979' },
      { mediaType: 'movie', tmdbId: 679, year: '1986' },
      { mediaType: 'movie', tmdbId: 8077, year: '1992' },
      { mediaType: 'movie', tmdbId: 395, year: '1997' },
    ],
  },
];

test('size buckets match franchise movie counts', () => {
  assert.equal(rowMatchesSize(sampleRows[0], ['short']), true);
  assert.equal(rowMatchesSize(sampleRows[1], ['short']), false);
  assert.equal(rowMatchesSize(sampleRows[1], ['medium']), true);
});

test('decade filter matches any movie in franchise', () => {
  assert.equal(rowMatchesDecade(sampleRows[0], ['1970s']), true);
  assert.equal(rowMatchesDecade(sampleRows[0], ['2010s']), false);
  assert.equal(
    rowMatchesDecade(sampleRows[0], [], { min: 1975, max: 1985 }),
    true,
  );
});

test('filters combine with AND across dimensions', () => {
  const filtered = filterCollectionRows(sampleRows, {
    searchQuery: 'alien',
    sizeFilters: ['medium'],
    decadeFilters: ['1970s'],
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 2);
});

test('badge count includes search and active filters', () => {
  assert.equal(countActiveFindBadge({
    searchQuery: 'star',
    sizeFilters: ['short'],
    decadeFilters: ['1970s', '1980s'],
  }), 4);
});

test('letter jump uses collection title', () => {
  const sorted = [...sampleRows].sort((a, b) => a.title.localeCompare(b.title));
  assert.equal(findRowIndexForLetter(sorted, 'S'), 1);
  assert.equal(findRowIndexForLetter(sorted, 'A'), 0);
});

test('library collection ids derive from saved watchlist keys', () => {
  const savedKeys = new Set(['movie:11']);
  const ids = getLibraryCollectionIds(sampleRows, savedKeys);
  assert.deepEqual([...ids], [1]);
});
