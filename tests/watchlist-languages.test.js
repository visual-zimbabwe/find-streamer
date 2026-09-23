import test from 'node:test';
import assert from 'node:assert/strict';
import {
  topWatchlistLanguages,
  resolveLanguageLabel,
  getAvailableWatchlistLanguages,
  normalizeWatchlistItem,
  itemInCollection,
  HIGHLY_RECOMMEND_COLLECTION_ID,
} from '../src/lib/watchlistModel.js';

// A minimal Highly Recommend row for the language selector.
function hrRow(tmdbId, code, extra = {}) {
  return {
    tmdbId,
    mediaType: 'movie',
    title: `Title ${tmdbId}`,
    watchlistCategoryId: HIGHLY_RECOMMEND_COLLECTION_ID,
    ...(code === undefined ? {} : { originalLanguageCode: code }),
    ...extra,
  };
}

// ─── normalizeWatchlistItem: originalLanguageCode handling ─────────────────────

test('normalize keeps and lower-cases a present language code', () => {
  const row = normalizeWatchlistItem(hrRow(1, 'FR'));
  assert.equal(row.originalLanguageCode, 'fr');
});

test('normalize leaves a truly absent code absent (so the backfill can spot it)', () => {
  const row = normalizeWatchlistItem(hrRow(2, undefined));
  assert.equal('originalLanguageCode' in row, false);
});

test('normalize preserves the "checked, none" empty-string sentinel', () => {
  const row = normalizeWatchlistItem(hrRow(3, ''));
  assert.equal(row.originalLanguageCode, '');
});

// ─── itemInCollection ──────────────────────────────────────────────────────────

test('itemInCollection matches via category id or collectionIds', () => {
  assert.equal(itemInCollection({ watchlistCategoryId: 'highly_recommend' }, 'highly_recommend'), true);
  assert.equal(itemInCollection({ collectionIds: ['highly_recommend'] }, 'highly_recommend'), true);
  assert.equal(itemInCollection({ watchlistCategoryId: 'watch_next' }, 'highly_recommend'), false);
  assert.equal(itemInCollection(null, 'highly_recommend'), false);
});

// ─── topWatchlistLanguages ─────────────────────────────────────────────────────

test('ranks languages by frequency, most common first', () => {
  const watchlist = [
    hrRow(1, 'en'),
    hrRow(2, 'en'),
    hrRow(3, 'fr'),
    hrRow(4, 'en'),
    hrRow(5, 'da'),
    hrRow(6, 'fr'),
  ];
  assert.deepEqual(topWatchlistLanguages(watchlist), ['en', 'fr', 'da']);
});

test('only counts titles in the target collection', () => {
  const watchlist = [
    hrRow(1, 'ko'),
    { tmdbId: 2, mediaType: 'movie', title: 'X', watchlistCategoryId: 'watch_next', originalLanguageCode: 'ja' },
  ];
  assert.deepEqual(topWatchlistLanguages(watchlist), ['ko']);
});

test('skips rows with no captured language code', () => {
  const watchlist = [hrRow(1, 'sv'), hrRow(2, undefined), hrRow(3, ''), hrRow(4, 'sv')];
  assert.deepEqual(topWatchlistLanguages(watchlist), ['sv']);
});

test('honors the limit', () => {
  const watchlist = [hrRow(1, 'en'), hrRow(2, 'fr'), hrRow(3, 'de'), hrRow(4, 'it')];
  assert.equal(topWatchlistLanguages(watchlist, { limit: 2 }).length, 2);
});

test('empty / non-array input yields no languages', () => {
  assert.deepEqual(topWatchlistLanguages([]), []);
  assert.deepEqual(topWatchlistLanguages(null), []);
  assert.deepEqual(topWatchlistLanguages(undefined), []);
});

// ─── resolveLanguageLabel ──────────────────────────────────────────────────────

test('resolveLanguageLabel maps ISO codes to English names', () => {
  assert.equal(resolveLanguageLabel('en'), 'English');
  assert.equal(resolveLanguageLabel('ko'), 'Korean');
  assert.equal(resolveLanguageLabel('ja'), 'Japanese');
  assert.equal(resolveLanguageLabel('fr'), 'French');
  assert.equal(resolveLanguageLabel('es'), 'Spanish');
  assert.equal(resolveLanguageLabel('other'), 'Other');
  assert.equal(resolveLanguageLabel(''), 'Other');
  assert.equal(resolveLanguageLabel(null), 'Other');
});

// ─── getAvailableWatchlistLanguages ────────────────────────────────────────────

test('getAvailableWatchlistLanguages returns distinct languages with counts sorted by frequency', () => {
  const watchlist = [
    { tmdbId: 1, mediaType: 'movie', title: 'A', watchlistCategoryId: 'watch_next', originalLanguageCode: 'ko' },
    { tmdbId: 2, mediaType: 'movie', title: 'B', watchlistCategoryId: 'watch_next', originalLanguageCode: 'ko' },
    { tmdbId: 3, mediaType: 'movie', title: 'C', watchlistCategoryId: 'watch_next', originalLanguageCode: 'en' },
    { tmdbId: 4, mediaType: 'movie', title: 'D', watchlistCategoryId: 'watch_next', originalLanguageCode: 'ja' },
    { tmdbId: 5, mediaType: 'movie', title: 'E', watchlistCategoryId: 'watch_next', originalLanguageCode: 'ko' },
  ];
  const result = getAvailableWatchlistLanguages(watchlist);
  assert.deepEqual(result, [
    { code: 'ko', label: 'Korean', count: 3 },
    { code: 'en', label: 'English', count: 1 },
    { code: 'ja', label: 'Japanese', count: 1 },
  ]);
});

test('getAvailableWatchlistLanguages groups titles with no language under other', () => {
  const watchlist = [
    { tmdbId: 1, mediaType: 'movie', title: 'A', watchlistCategoryId: 'watch_next', originalLanguageCode: 'en' },
    { tmdbId: 2, mediaType: 'movie', title: 'B', watchlistCategoryId: 'watch_next', originalLanguageCode: '' },
    { tmdbId: 3, mediaType: 'movie', title: 'C', watchlistCategoryId: 'watch_next' }, // undefined
    { tmdbId: 4, mediaType: 'movie', title: 'D', watchlistCategoryId: 'watch_next', originalLanguageCode: 'fr' },
  ];
  const result = getAvailableWatchlistLanguages(watchlist);
  assert.deepEqual(result, [
    { code: 'en', label: 'English', count: 1 },
    { code: 'fr', label: 'French', count: 1 },
    { code: 'other', label: 'Other', count: 2, isOther: true },
  ]);
});

test('getAvailableWatchlistLanguages dedupes items in multiple collections', () => {
  const watchlist = [
    { tmdbId: 1, mediaType: 'movie', title: 'A', watchlistCategoryId: 'watch_next', collectionIds: ['watch_next', 'highly_recommend'], originalLanguageCode: 'es' },
    { tmdbId: 2, mediaType: 'movie', title: 'B', watchlistCategoryId: 'watch_next', collectionIds: ['watch_next'], originalLanguageCode: 'es' },
  ];
  const result = getAvailableWatchlistLanguages(watchlist);
  assert.deepEqual(result, [
    { code: 'es', label: 'Spanish', count: 2 },
  ]);
});

test('getAvailableWatchlistLanguages returns empty array for empty input', () => {
  assert.deepEqual(getAvailableWatchlistLanguages([]), []);
  assert.deepEqual(getAvailableWatchlistLanguages(null), []);
});


