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

export const CATEGORY_PILLS = [
  { key: 'all', label: 'All' },
  { key: 'popular', label: 'Popular' },
  { key: 'top_rated', label: 'Top Rated' },
  { key: 'sagas', label: 'Sagas (4+)' },
  { key: 'scifi', label: 'Sci-Fi & Fantasy' },
  { key: 'action', label: 'Action & Crime' },
  { key: 'animation', label: 'Animation' },
  { key: 'horror', label: 'Horror' },
];

export const CURATED_UNIVERSES = [
  { id: 'star_wars', label: 'Star Wars', query: 'Star Wars' },
  { id: 'wizarding_world', label: 'Harry Potter', query: 'Harry Potter' },
  { id: 'middle_earth', label: 'Lord of the Rings', query: 'Lord of the Rings' },
  { id: 'dc_universe', label: 'DC & Batman', query: 'Batman' },
  { id: 'mcu', label: 'Marvel & Avengers', query: 'Avengers' },
  { id: 'james_bond', label: 'James Bond 007', query: 'James Bond' },
  { id: 'fast_furious', label: 'Fast & Furious', query: 'Fast and the Furious' },
  { id: 'jurassic', label: 'Jurassic Era', query: 'Jurassic' },
  { id: 'alien_predator', label: 'Alien & Predator', query: 'Alien' },
  { id: 'mission_impossible', label: 'Mission Impossible', query: 'Mission: Impossible' },
  { id: 'godfather', label: 'The Godfather', query: 'Godfather' },
  { id: 'john_wick', label: 'John Wick', query: 'John Wick' },
];

export const POPULAR_FRANCHISE_KEYWORDS = [
  'star wars', 'the lord of the rings', 'lord of the rings', 'harry potter', 'the godfather',
  'godfather', 'the dark knight', 'dark knight', 'indiana jones', 'james bond',
  'mission: impossible', 'mission impossible', 'pirates of the caribbean', 'toy story',
  'jurassic park', 'alien', 'the matrix', 'matrix', 'back to the future',
  'fast & furious', 'fast and the furious', 'john wick', 'spider-man', 'the avengers',
  'avengers', 'dune', 'batman', 'shrek', 'despicable me', 'the hunger games',
  'hunger games', 'blade runner', 'planet of the apes', 'rocky', 'creed', 'bourne',
  'transformers', 'mad max', 'scream', 'halloween', 'die hard', 'avatar',
  'twilight', 'ice age', 'how to train your dragon', 'kung fu panda', 'the incredibles',
  'incredibles', 'cars', 'knives out', 'deadpool', 'guardians of the galaxy', 'thor',
  'captain america', 'iron man', 'x-men', 'terminator', 'predator', 'ghostbusters',
  'jumanji', 'rambo', "ocean's", 'the conjuring', 'conjuring', 'saw', 'evil dead',
  'a quiet place', 'godzilla', 'monsterverse', 'top gun', 'bad boys', 'lethal weapon',
  'beverly hills cop', 'men in black', 'monsters, inc.', 'finding nemo', 'paddington',
  'kingsman', 'wolverine', 'spider-verse', 'middle earth', 'dc extended universe',
  'national treasure', 'percy jackson', 'maze runner', 'divergent', 'the chronicles of narnia',
  'blade', 'robocop', 'austin powers', 'the hangover', 'final destination', 'insidious',
  'the purge', 'paranormal activity', 'rush hour'
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
  if (row.title.toLowerCase().includes(query)) return true;
  // Also match individual movie titles inside the collection
  return row.items.some((item) => item.title?.toLowerCase().includes(query));
}

export function rowMatchesCategory(row, categoryKey = 'all') {
  if (!categoryKey || categoryKey === 'all') return true;

  const titleLower = row.title.toLowerCase();
  const allTitles = `${titleLower} ${row.items.map((i) => i.title?.toLowerCase() || '').join(' ')}`;

  if (categoryKey === 'popular') {
    return (
      POPULAR_FRANCHISE_KEYWORDS.some((kw) => titleLower.includes(kw)) ||
      (row.items.length >= 3 && (row.avgRatingValue || 0) >= 7.0)
    );
  }

  if (categoryKey === 'top_rated') {
    return (row.avgRatingValue || 0) >= 7.5 || (row.firstMovieRatingValue || 0) >= 8.0;
  }

  if (categoryKey === 'sagas') {
    return row.items.length >= 4;
  }

  if (categoryKey === 'scifi') {
    const scifiKeywords = [
      'star', 'wars', 'lord of the rings', 'matrix', 'alien', 'predator', 'terminator',
      'dune', 'blade runner', 'planet of the apes', 'avatar', 'jurassic', 'marvel',
      'avengers', 'batman', 'spider-man', 'superman', 'iron man', 'thor', 'x-men',
      'guardians of the galaxy', 'deadpool', 'transformers', 'back to the future',
      'hunger games', 'divergent', 'maze runner', 'star trek', 'godzilla', 'kong',
      'monsterverse', 'cyber', 'space', 'galaxy', 'future', 'robot'
    ];
    return scifiKeywords.some((kw) => allTitles.includes(kw));
  }

  if (categoryKey === 'action') {
    const actionKeywords = [
      'fast & furious', 'fast and the furious', 'john wick', 'mission: impossible',
      'james bond', '007', 'bourne', 'die hard', 'rocky', 'creed', 'rambo',
      'mad max', 'lethal weapon', 'bad boys', 'kingsman', 'equalizer', 'taken',
      'expendables', 'jack reacher', 'transporter', 'godfather', 'ocean', 'rush hour'
    ];
    return actionKeywords.some((kw) => allTitles.includes(kw));
  }

  if (categoryKey === 'animation') {
    const animKeywords = [
      'toy story', 'shrek', 'despicable me', 'ice age', 'kung fu panda', 'dragon',
      'incredibles', 'cars', 'monsters', 'nemo', 'dory', 'madagascar', 'hotel transylvania',
      'minions', 'lion king', 'aladdin', 'beauty and the beast', 'tarzan', 'mulan',
      'frozen', 'moana', 'zootopia', 'ralph', 'croods', 'trolls', 'boss baby',
      'lego', 'sponge', 'pokemon', 'digimon', 'spirited away', 'totoro', 'ghibli'
    ];
    return animKeywords.some((kw) => allTitles.includes(kw));
  }

  if (categoryKey === 'horror') {
    const horrorKeywords = [
      'scream', 'halloween', 'saw', 'conjuring', 'evil dead', 'chucky', 'annabelle',
      'insidious', 'paranormal', 'purge', 'final destination', 'nightmare on elm',
      'friday the 13th', 'texas chain', 'hellraiser', 'exorcist', 'alien', 'predator',
      'dracula', 'frankenstein', 'mummy', 'quiet place', 'ring', 'grudge', 'candyman'
    ];
    return horrorKeywords.some((kw) => allTitles.includes(kw));
  }

  return true;
}

export function rowMatchesLetter(row, letterFilter = null) {
  if (!letterFilter || letterFilter === 'all') return true;
  return getCollectionSortLetter(row.title) === letterFilter.toUpperCase();
}

export function filterCollectionRows(rows, filters = {}) {
  const {
    searchQuery = '',
    sizeFilters = [],
    decadeFilters = [],
    customDecadeRange = null,
    categoryFilter = 'all',
    letterFilter = null,
  } = filters;

  return rows.filter(
    (row) =>
      rowMatchesSearch(row, searchQuery) &&
      rowMatchesCategory(row, categoryFilter) &&
      rowMatchesLetter(row, letterFilter) &&
      rowMatchesSize(row, sizeFilters) &&
      rowMatchesDecade(row, decadeFilters, customDecadeRange),
  );
}

function calculatePopularityScore(row) {
  const titleLower = row.title.toLowerCase();
  let popBonus = 0;
  for (let i = 0; i < POPULAR_FRANCHISE_KEYWORDS.length; i++) {
    if (titleLower.includes(POPULAR_FRANCHISE_KEYWORDS[i])) {
      // Flagship boost
      popBonus = 2000 - i * 15;
      break;
    }
  }

  const artBonus = row.hasArt ? 100 : -500;
  const countBonus = Math.min(row.items.length, 12) * 10;
  const ratingBonus = (row.avgRatingValue || row.firstMovieRatingValue || 0) * 15;
  return popBonus + artBonus + countBonus + ratingBonus;
}

export function sortCollectionRows(rows, sortMode = 'popular') {
  const sorted = [...rows];
  if (sortMode === 'az') {
    return sorted.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    );
  }

  if (sortMode === 'count') {
    return sorted.sort((a, b) => {
      const diff = b.items.length - a.items.length;
      if (diff !== 0) return diff;
      return calculatePopularityScore(b) - calculatePopularityScore(a);
    });
  }

  if (sortMode === 'popular' || sortMode === 'featured') {
    return sorted.sort((a, b) => calculatePopularityScore(b) - calculatePopularityScore(a));
  }

  // sortMode === 'rating'
  return sorted.sort((a, b) => {
    // Artwork present comes before blank artwork
    const artA = a.hasArt ? 1 : 0;
    const artB = b.hasArt ? 1 : 0;
    if (artA !== artB) return artB - artA;

    // Highest rating first
    const scoreA = a.firstMovieRatingValue || a.avgRatingValue || 0;
    const scoreB = b.firstMovieRatingValue || b.avgRatingValue || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;

    return b.items.length - a.items.length;
  });
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

export function getRowsForIds(rows, ids, sortMode = 'popular') {
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
  categoryFilter = 'all',
  letterFilter = null,
}) {
  let count = sizeFilters.length + decadeFilters.length;
  if (customDecadeRangeHasInput(customDecadeRange)) {
    count += 1;
  }
  if (searchQuery.trim()) count += 1;
  if (categoryFilter && categoryFilter !== 'all') count += 1;
  if (letterFilter && letterFilter !== 'all') count += 1;
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

export function getLetterCounts(rows) {
  const counts = {};
  for (const row of rows) {
    const letter = getCollectionSortLetter(row.title);
    counts[letter] = (counts[letter] || 0) + 1;
  }
  return counts;
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

