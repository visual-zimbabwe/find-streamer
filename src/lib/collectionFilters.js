export const SIZE_FILTER_KEYS = ['short', 'medium', 'long'];

export const SIZE_BUCKETS = {
  short: { min: 2, max: 3, label: 'Short' },
  medium: { min: 4, max: 5, label: 'Medium' },
  long: { min: 6, max: Infinity, label: 'Long' },
};

export const DECADE_PRESETS = [
  { key: '1930s', min: 1930, max: 1939 },
  { key: '1940s', min: 1940, max: 1949 },
  { key: '1950s', min: 1950, max: 1959 },
  { key: '1960s', min: 1960, max: 1969 },
  { key: '1970s', min: 1970, max: 1979 },
  { key: '1980s', min: 1980, max: 1989 },
  { key: '1990s', min: 1990, max: 1999 },
  { key: '2000s', min: 2000, max: 2009 },
  { key: '2010s', min: 2010, max: 2019 },
  { key: '2020s', min: 2020, max: 2029 },
];

export function getMovieYear(item) {
  const year = Number.parseInt(item?.year, 10);
  return Number.isFinite(year) ? year : null;
}

export function rowItemYears(row) {
  return row.items.map(getMovieYear).filter((year) => year != null);
}

export function getEarliestRowYear(row) {
  const years = rowItemYears(row);
  if (!years.length) return null;
  return Math.min(...years);
}

export function customDecadeRangeHasInput(customDecadeRange = null) {
  return (
    customDecadeRange != null && (customDecadeRange.min != null || customDecadeRange.max != null)
  );
}

export function validateCustomDecadeRange(customDecadeRange = null) {
  if (!customDecadeRangeHasInput(customDecadeRange)) return null;

  const curYear = new Date().getFullYear();
  const { min, max } = customDecadeRange;

  if (min != null && (min < 1900 || min > curYear + 5)) {
    return `"From Year" must be between 1900 and ${curYear + 5}.`;
  }
  if (max != null && (max < 1900 || max > curYear + 5)) {
    return `"To Year" must be between 1900 and ${curYear + 5}.`;
  }
  return null;
}

export function resolveCustomDecadeRange(customDecadeRange = null) {
  if (!customDecadeRangeHasInput(customDecadeRange)) return null;
  if (validateCustomDecadeRange(customDecadeRange)) return null;

  const curYear = new Date().getFullYear();
  return {
    min: customDecadeRange.min ?? 1800,
    max: customDecadeRange.max ?? curYear,
  };
}

export function rowMatchesSize(row, selectedSizes = []) {
  if (!selectedSizes.length) return true;
  const count = row.items.length;
  return selectedSizes.some((sizeKey) => {
    const bucket = SIZE_BUCKETS[sizeKey];
    if (!bucket) return false;
    return count >= bucket.min && count <= bucket.max;
  });
}

export function yearMatchesDecadeFilters(year, decadeFilters = [], resolvedCustomRange = null) {
  if (year == null) return false;

  const presetMatch = decadeFilters.some((decadeKey) => {
    const preset = DECADE_PRESETS.find((entry) => entry.key === decadeKey);
    if (!preset) return false;
    return year >= preset.min && year <= preset.max;
  });

  if (!resolvedCustomRange) return presetMatch;

  const customMatch = year >= resolvedCustomRange.min && year <= resolvedCustomRange.max;

  if (!decadeFilters.length) return customMatch;
  return presetMatch || customMatch;
}

export function rowMatchesDecade(row, decadeFilters = [], customDecadeRange = null) {
  const hasDecadeFilters = decadeFilters.length > 0;
  const resolvedCustomRange = resolveCustomDecadeRange(customDecadeRange);
  const hasCustomRange = resolvedCustomRange != null;

  if (!hasDecadeFilters && !hasCustomRange) return true;

  const year = getEarliestRowYear(row);
  if (year == null) return false;

  return yearMatchesDecadeFilters(year, decadeFilters, resolvedCustomRange);
}

export function rowMatchesSearch(row, searchQuery = '') {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  return row.title.toLowerCase().includes(query);
}

export function filterCollectionRows(rows, filters = {}) {
  const {
    searchQuery = '',
    sizeFilters = [],
    decadeFilters = [],
    customDecadeRange = null,
  } = filters;

  return rows.filter(
    (row) =>
      rowMatchesSearch(row, searchQuery) &&
      rowMatchesSize(row, sizeFilters) &&
      rowMatchesDecade(row, decadeFilters, customDecadeRange),
  );
}

export function sortCollectionRows(rows, sortMode = 'rating') {
  const sorted = [...rows];
  if (sortMode === 'az') {
    return sorted.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    );
  }
  return sorted.sort((a, b) => b.firstMovieRatingValue - a.firstMovieRatingValue);
}

export function getLibraryCollectionIds(
  rows,
  savedKeys,
  entryKeyFn = (item) => `${item.mediaType}:${item.tmdbId}`,
) {
  const ids = new Set();
  for (const row of rows) {
    const inLibrary = row.items.some((item) => {
      const key = entryKeyFn(item);
      return key && savedKeys.has(key);
    });
    if (inLibrary) ids.add(row.id);
  }
  return ids;
}

export function getRowsForIds(rows, ids, sortMode = 'rating') {
  const idSet = ids instanceof Set ? ids : new Set(ids);
  return sortCollectionRows(
    rows.filter((row) => idSet.has(row.id)),
    sortMode,
  );
}

export function countActiveFindBadge({
  searchQuery = '',
  sizeFilters = [],
  decadeFilters = [],
  customDecadeRange = null,
}) {
  let count = sizeFilters.length + decadeFilters.length;
  if (customDecadeRangeHasInput(customDecadeRange)) {
    count += 1;
  }
  if (searchQuery.trim()) count += 1;
  return count;
}

export function getCollectionSortLetter(title = '') {
  const first = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

export function getIndexLetters(rows) {
  const letters = new Set();
  for (const row of rows) {
    letters.add(getCollectionSortLetter(row.title));
  }
  return [...letters].sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });
}

export function findRowIndexForLetter(rows, letter) {
  const target = letter.toUpperCase();
  return rows.findIndex((row) => getCollectionSortLetter(row.title) === target);
}

export function buildJumpToNames(rows) {
  return [...rows]
    .map((row) => ({ id: row.id, title: row.title }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
}
