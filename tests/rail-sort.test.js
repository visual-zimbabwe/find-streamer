const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_RAIL_SORT,
  VALID_RAIL_SORTS,
  resolveYearValue,
  sortRailItems,
  toggleRailSortMode,
} = require(path.join(__dirname, '..', 'src', 'lib', 'railSort.js'));

test('resolveYearValue extracts year from various item formats', () => {
  assert.equal(resolveYearValue({ year: 2024 }), 2024);
  assert.equal(resolveYearValue({ year: '2023' }), 2023);
  assert.equal(resolveYearValue({ year: '2021–2023' }), 2021);
  assert.equal(resolveYearValue({ year: '2019–' }), 2019);
  assert.equal(resolveYearValue({ releaseDate: '2020-05-15' }), 2020);
  assert.equal(resolveYearValue({ firstAirDate: '2018-09-21' }), 2018);
  assert.equal(resolveYearValue({ awardYear: 2022, year: 2020 }), 2022);
  assert.equal(resolveYearValue({ awardYear: '2015', releaseDate: '2014-12-01' }), 2015);
  assert.equal(resolveYearValue({ year: 'N/A' }), 0);
  assert.equal(resolveYearValue(null), 0);
  assert.equal(resolveYearValue({}), 0);
});

test('sortRailItems sorts by rating descending by default', () => {
  const items = [
    { title: 'Good', ratingValue: 7.5, year: 2020 },
    { title: 'Masterpiece', ratingValue: 9.1, year: 1994 },
    { title: 'Average', ratingValue: 6.2, year: 2023 },
  ];

  const sorted = sortRailItems(items, 'rating');
  assert.deepEqual(
    sorted.map((i) => i.title),
    ['Masterpiece', 'Good', 'Average'],
  );
  // Does not mutate original array
  assert.equal(items[0].title, 'Good');
});

test('sortRailItems breaks rating ties with release year descending', () => {
  const items = [
    { title: 'Older Classic', ratingValue: 8.5, year: 1999 },
    { title: 'Newer Classic', ratingValue: 8.5, year: 2022 },
  ];

  const sorted = sortRailItems(items, 'rating');
  assert.deepEqual(
    sorted.map((i) => i.title),
    ['Newer Classic', 'Older Classic'],
  );
});

test('sortRailItems sorts by year descending when sortMode is year', () => {
  const items = [
    { title: 'Old Classic', ratingValue: 9.2, year: 1972 },
    { title: 'Recent Hit', ratingValue: 8.0, year: 2024 },
    { title: 'Mid-Era', ratingValue: 7.5, year: 2008 },
  ];

  const sorted = sortRailItems(items, 'year');
  assert.deepEqual(
    sorted.map((i) => i.title),
    ['Recent Hit', 'Mid-Era', 'Old Classic'],
  );
});

test('sortRailItems breaks year ties with rating descending', () => {
  const items = [
    { title: '2024 Good', ratingValue: 7.2, year: 2024 },
    { title: '2024 Best', ratingValue: 8.9, year: 2024 },
  ];

  const sorted = sortRailItems(items, 'year');
  assert.deepEqual(
    sorted.map((i) => i.title),
    ['2024 Best', '2024 Good'],
  );
});

test('sortRailItems handles empty, null or missing inputs safely', () => {
  assert.deepEqual(sortRailItems(null), []);
  assert.deepEqual(sortRailItems([]), []);
  assert.deepEqual(sortRailItems(undefined, 'year'), []);
});

test('toggleRailSortMode toggles cleanly between rating and year', () => {
  assert.equal(DEFAULT_RAIL_SORT, 'rating');
  assert.deepEqual(VALID_RAIL_SORTS, ['rating', 'year']);
  assert.equal(toggleRailSortMode('rating'), 'year');
  assert.equal(toggleRailSortMode('year'), 'rating');
  assert.equal(toggleRailSortMode(null), 'year');
  assert.equal(toggleRailSortMode(undefined), 'year');
});
