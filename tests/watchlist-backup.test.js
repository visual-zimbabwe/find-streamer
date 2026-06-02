const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  mergeWatchlistsNoDuplicates,
  mergeCollectionsNoDuplicates,
  normalizeImportedWatchlistItems,
  parseWatchlistImportJson,
  stringifyWatchlistExport,
  watchlistEntryKey,
} = require(path.join(__dirname, '..', 'src', 'lib', 'watchlistBackup.js'));

test('watchlistEntryKey distinguishes movie vs tv', () => {
  assert.equal(watchlistEntryKey({ mediaType: 'movie', tmdbId: 1 }), 'movie:1');
  assert.equal(watchlistEntryKey({ mediaType: 'tv', tmdbId: 1 }), 'tv:1');
  assert.equal(watchlistEntryKey({ mediaType: 'movie' }), null);
});

test('normalizeImportedWatchlistItems dedupes and filters invalid rows', () => {
  const items = normalizeImportedWatchlistItems([
    { tmdbId: 1, title: 'A', mediaType: 'movie', watchlistCategoryId: 'watch_next' },
    { tmdbId: 1, title: 'A dup', mediaType: 'movie' },
    { tmdbId: 2, title: '', mediaType: 'movie' },
    { tmdbId: 3, title: 'B', mediaType: 'tv', watchlistCategoryId: 'bogus' },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'A');
  assert.equal(items[1].mediaType, 'tv');
  assert.equal(items[1].watchlistCategoryId, 'watch_next');
});

test('mergeWatchlistsNoDuplicates skips titles already on device', () => {
  const existing = [{ tmdbId: 1, title: 'Local', mediaType: 'movie', watchlistCategoryId: 'watched' }];
  const incoming = [
    { tmdbId: 1, title: 'File', mediaType: 'movie', watchlistCategoryId: 'watch_next' },
    { tmdbId: 2, title: 'New', mediaType: 'movie', watchlistCategoryId: 'watch_next' },
  ];
  const merged = mergeWatchlistsNoDuplicates(existing, incoming);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, 'Local');
  assert.equal(merged[0].watchlistCategoryId, 'watched');
  assert.equal(merged[1].tmdbId, 2);
});

test('parseWatchlistImportJson accepts envelope and raw array', () => {
  const payload = JSON.parse(stringifyWatchlistExport(
    [{ tmdbId: 9, title: 'Z', mediaType: 'tv' }],
    [{ id: 'custom_faves', name: 'Faves' }]
  ));
  assert.equal(payload.exportKind, 'find-streamer-watchlist');
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.collections[0].id, 'custom_faves');
  const a = parseWatchlistImportJson(JSON.stringify(payload));
  assert.equal(a.ok, true);
  assert.equal(a.items.length, 1);
  assert.equal(a.collections.length, 1);

  const b = parseWatchlistImportJson(JSON.stringify([{ tmdbId: 8, title: 'Y', mediaType: 'movie' }]));
  assert.equal(b.ok, true);
  assert.equal(b.items[0].tmdbId, 8);
});

test('mergeCollectionsNoDuplicates preserves local collections first', () => {
  const merged = mergeCollectionsNoDuplicates(
    [{ id: 'custom_a', name: 'Local' }],
    [{ id: 'custom_a', name: 'Incoming Duplicate' }, { id: 'custom_b', name: 'Incoming' }]
  );

  assert.equal(merged.length, 2);
  assert.equal(merged[0].name, 'Local');
  assert.equal(merged[1].id, 'custom_b');
});
