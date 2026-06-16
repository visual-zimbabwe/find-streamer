import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeResolvedSynopsisIntoWatchlistRow,
  applyCreateCollection,
  applyToggleCollection,
  applySetStatus,
  addOrRestoreItem,
  removeItem,
  markItemWatched,
} from '../src/lib/watchlistActions.js';
import { normalizeWatchlistItem, watchlistEntryKey } from '../src/lib/watchlistModel.js';

function makeItem(overrides = {}) {
  return normalizeWatchlistItem({
    tmdbId: 100,
    mediaType: 'movie',
    title: 'Test Movie',
    status: 'saved',
    collectionIds: [],
    ...overrides,
  });
}

test('mergeResolvedSynopsisIntoWatchlistRow prefers a real TMDB synopsis', () => {
  const row = { synopsis: 'old' };
  const merged = mergeResolvedSynopsisIntoWatchlistRow(row, { synopsis: 'A great film.' });
  assert.equal(merged.synopsis, 'A great film.');
  assert.notEqual(merged, row); // pure: new object
});

test('mergeResolvedSynopsisIntoWatchlistRow falls back to OMDb plot for placeholder synopsis', () => {
  const row = { synopsis: 'old' };
  const merged = mergeResolvedSynopsisIntoWatchlistRow(row, {
    synopsis: 'No synopsis available.',
    omdbRatings: { plot: 'OMDb plot text' },
  });
  assert.equal(merged.synopsis, 'OMDb plot text');
  assert.deepEqual(merged.omdbRatings, { plot: 'OMDb plot text' });
});

test('mergeResolvedSynopsisIntoWatchlistRow keeps existing synopsis when nothing better is provided', () => {
  const row = { synopsis: 'existing summary' };
  const merged = mergeResolvedSynopsisIntoWatchlistRow(row, { synopsis: '   ' });
  assert.equal(merged.synopsis, 'existing summary');
});

test('applyCreateCollection appends the collection id and un-drops a dropped item', () => {
  const item = makeItem({ status: 'dropped', collectionIds: ['a'] });
  const next = applyCreateCollection(item, { id: 'b' });
  assert.equal(next.status, 'saved');
  assert.deepEqual(next.collectionIds, ['a', 'b']);
});

test('applyCreateCollection preserves a non-dropped status', () => {
  const item = makeItem({ status: 'watching', collectionIds: [] });
  const next = applyCreateCollection(item, { id: 'b' });
  assert.equal(next.status, 'watching');
  assert.deepEqual(next.collectionIds, ['b']);
});

test('applyToggleCollection adds a collection and un-drops the item', () => {
  const item = makeItem({ status: 'dropped', collectionIds: [] });
  const next = applyToggleCollection(item, 'favs');
  assert.equal(next.status, 'saved');
  assert.deepEqual(next.collectionIds, ['favs']);
});

test('applyToggleCollection removes a collection it already contains', () => {
  const item = makeItem({ status: 'saved', collectionIds: ['favs', 'later'] });
  const next = applyToggleCollection(item, 'favs');
  assert.deepEqual(next.collectionIds, ['later']);
  assert.equal(next.status, 'saved');
});

test('applyToggleCollection on `watched` sets status to watched when adding', () => {
  const item = makeItem({ status: 'saved', collectionIds: [] });
  const next = applyToggleCollection(item, 'watched');
  assert.equal(next.status, 'watched');
  assert.ok(next.collectionIds.includes('watched'));
});

test('applyToggleCollection on `watched` reverts status to saved when removing', () => {
  const item = makeItem({ status: 'watched', collectionIds: ['watched'] });
  const next = applyToggleCollection(item, 'watched');
  assert.equal(next.status, 'saved');
  assert.ok(!next.collectionIds.includes('watched'));
});

test('applySetStatus to watched adds the watched collection membership', () => {
  const item = makeItem({ status: 'saved', collectionIds: ['favs'] });
  const next = applySetStatus(item, 'watched');
  assert.equal(next.status, 'watched');
  assert.ok(next.collectionIds.includes('watched'));
  assert.ok(next.collectionIds.includes('favs'));
});

test('applySetStatus away from watched removes the watched collection membership', () => {
  const item = makeItem({ status: 'watched', collectionIds: ['watched', 'favs'] });
  const next = applySetStatus(item, 'watching');
  assert.equal(next.status, 'watching');
  assert.ok(!next.collectionIds.includes('watched'));
  assert.deepEqual(next.collectionIds, ['favs']);
});

test('addOrRestoreItem adds a brand new saved item at the front', () => {
  const watchlist = [makeItem({ tmdbId: 1 })];
  const result = { tmdbId: 2, mediaType: 'tv', title: 'New Show' };
  const out = addOrRestoreItem(watchlist, result);
  assert.equal(out.action, 'added');
  assert.equal(out.watchlist.length, 2);
  assert.equal(watchlistEntryKey(out.watchlist[0]), 'tv:2');
  assert.equal(out.item.status, 'saved');
  assert.deepEqual(out.item.collectionIds, []);
});

test('addOrRestoreItem dedupes by entry key when adding', () => {
  const watchlist = [makeItem({ tmdbId: 5, mediaType: 'movie', title: 'Dup' })];
  const result = { tmdbId: 5, mediaType: 'movie', title: 'Dup', status: 'dropped' };
  // existing in library -> returns exists, not duplicated
  const out = addOrRestoreItem(watchlist, result);
  assert.equal(out.action, 'exists');
  assert.equal(out.watchlist.length, 1);
});

test('addOrRestoreItem restores a dropped item to saved', () => {
  const watchlist = [makeItem({ tmdbId: 7, status: 'dropped', collectionIds: ['favs'] })];
  const out = addOrRestoreItem(watchlist, { tmdbId: 7, mediaType: 'movie', title: 'Test Movie' });
  assert.equal(out.action, 'restored');
  assert.equal(out.item.status, 'saved');
  assert.equal(out.watchlist.length, 1);
  assert.deepEqual(out.watchlist[0].collectionIds, ['favs']);
});

test('addOrRestoreItem reports an item already in the library without mutating', () => {
  const watchlist = [makeItem({ tmdbId: 9, status: 'watching' })];
  const out = addOrRestoreItem(watchlist, { tmdbId: 9, mediaType: 'movie', title: 'Test Movie' });
  assert.equal(out.action, 'exists');
  assert.equal(out.watchlist, watchlist); // same reference, no-op
});

test('removeItem drops the matching entry', () => {
  const watchlist = [makeItem({ tmdbId: 1 }), makeItem({ tmdbId: 2 })];
  const next = removeItem(watchlist, 'movie:1');
  assert.equal(next.length, 1);
  assert.equal(watchlistEntryKey(next[0]), 'movie:2');
});

test('removeItem returns the same reference when nothing matches (no-op)', () => {
  const watchlist = [makeItem({ tmdbId: 1 })];
  assert.equal(removeItem(watchlist, 'movie:999'), watchlist);
  assert.equal(removeItem(watchlist, null), watchlist);
});

test('markItemWatched flips status to watched', () => {
  const watchlist = [makeItem({ tmdbId: 1, status: 'saved' })];
  const next = markItemWatched(watchlist, 'movie:1');
  assert.notEqual(next, watchlist);
  assert.equal(next[0].status, 'watched');
});

test('markItemWatched is a no-op when already watched (same reference)', () => {
  const watchlist = [makeItem({ tmdbId: 1, status: 'watched' })];
  assert.equal(markItemWatched(watchlist, 'movie:1'), watchlist);
  assert.equal(markItemWatched(watchlist, null), watchlist);
});
