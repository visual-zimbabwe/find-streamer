import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_SPOTLIGHT_MAX,
  buildBundledSpotlightSeed,
  buildSyncHomeSpotlight,
  mediaFilterToScope,
  orderSpotlightCandidates,
} from '../src/lib/homeSpotlightCore.js';
import { normalizeWatchlistItem } from '../src/lib/watchlistModel.js';

test('mediaFilterToScope maps filter values', () => {
  assert.equal(mediaFilterToScope(null), 'all');
  assert.equal(mediaFilterToScope('movie'), 'movie');
  assert.equal(mediaFilterToScope('tv'), 'tv');
});

test('orderSpotlightCandidates ranks movies before TV for mixed scope', () => {
  const ordered = orderSpotlightCandidates(
    [
      { mediaType: 'tv', tmdbId: 1, title: 'Show A' },
      { mediaType: 'movie', tmdbId: 2, title: 'Movie A' },
      { mediaType: 'tv', tmdbId: 3, title: 'Show B' },
      { mediaType: 'movie', tmdbId: 4, title: 'Movie B' },
    ],
    'all',
  );

  const firstMovieIndex = ordered.findIndex((item) => item.mediaType === 'movie');
  const firstTvIndex = ordered.findIndex((item) => item.mediaType === 'tv');
  assert.ok(firstMovieIndex >= 0);
  assert.ok(firstTvIndex >= 0);
  assert.ok(firstMovieIndex < firstTvIndex);
});

test('buildBundledSpotlightSeed returns six scoped items', () => {
  const tv = buildBundledSpotlightSeed('tv');
  const movie = buildBundledSpotlightSeed('movie');
  const all = buildBundledSpotlightSeed('all');

  assert.equal(tv.length, HOME_SPOTLIGHT_MAX);
  assert.equal(movie.length, HOME_SPOTLIGHT_MAX);
  assert.equal(all.length, HOME_SPOTLIGHT_MAX);
  assert.ok(tv.every((item) => item.mediaType === 'tv'));
  assert.ok(movie.every((item) => item.mediaType === 'movie'));
  assert.ok(all.every((item) => item.mediaType === 'movie' || item.mediaType === 'tv'));
});

test('buildSyncHomeSpotlight prefers Watch Next before IMDb for scoped pools', () => {
  const watchlist = [
    normalizeWatchlistItem({
      tmdbId: 999001,
      mediaType: 'tv',
      title: 'Queued Show',
      status: 'saved',
      collectionIds: ['watch_next'],
    }),
  ];

  const items = buildSyncHomeSpotlight(watchlist, 'tv');
  assert.ok(items.some((item) => item.tmdbId === 999001));
  assert.equal(items.length, HOME_SPOTLIGHT_MAX);
  assert.ok(items.every((item) => item.mediaType === 'tv'));
});
