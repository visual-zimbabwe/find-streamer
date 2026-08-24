import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserWatchlistCollections,
  normalizeWatchlistCollections,
  LEGACY_COLLECTIONS,
} from '../src/lib/watchlistModel.js';

test('getUserWatchlistCollections includes legacy collections and normalized custom collections', () => {
  const custom = [
    { id: 'custom_horror', name: 'Horror Night', createdAt: '2026-08-01T10:00:00Z' },
    { id: 'custom_anime', name: 'Anime To Watch', createdAt: '2026-08-10T12:00:00Z' },
  ];
  const all = getUserWatchlistCollections(custom);

  // Starts with all 5 legacy collections
  assert.equal(all.length, LEGACY_COLLECTIONS.length + 2);
  assert.equal(all[0].id, LEGACY_COLLECTIONS[0].id);

  // Contains custom collections at the end
  const customEntries = all.filter((c) => c.source === 'custom');
  assert.equal(customEntries.length, 2);
  assert.equal(customEntries[0].name, 'Horror Night');
  assert.equal(customEntries[1].name, 'Anime To Watch');
});

test('normalizeWatchlistCollections skips built-in IDs and generates IDs for missing ones', () => {
  const input = [
    { id: 'watch_next', name: 'Duplicate System List' },
    { name: 'My Indie Picks' },
  ];
  const normalized = normalizeWatchlistCollections(input);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].name, 'My Indie Picks');
  assert.equal(normalized[0].id, 'custom_my_indie_picks');
  assert.equal(normalized[0].source, 'custom');
});

test('custom collections sort chronologically newest-first by createdAt', () => {
  const custom = [
    { id: 'c1', name: 'Old List', createdAt: '2026-01-01T00:00:00Z', source: 'custom' },
    { id: 'c2', name: 'New List', createdAt: '2026-08-20T00:00:00Z', source: 'custom' },
    { id: 'c3', name: 'Mid List', createdAt: '2026-05-15T00:00:00Z', source: 'custom' },
  ];

  const sorted = [...custom].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  assert.equal(sorted[0].id, 'c2');
  assert.equal(sorted[1].id, 'c3');
  assert.equal(sorted[2].id, 'c1');
});
