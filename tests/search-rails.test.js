import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOW_PLAYING_MIN_VOTES,
  RAIL_LIMIT,
  dedupeRailItems,
  formatWatchers,
  interleaveByTrendingRank,
  selectNowPlaying,
} from '../src/lib/searchRails.js';

const trending = (mediaType, rank, extra = {}) => ({
  mediaType,
  tmdbId: `${mediaType}-${rank}`,
  title: `${mediaType} ${rank}`,
  trendingRank: rank,
  ...extra,
});

const playing = (id, popularity, voteCount, ratingValue = 5) => ({
  mediaType: 'movie',
  tmdbId: id,
  title: `movie ${id}`,
  popularity,
  voteCount,
  ratingValue,
});

test('interleave alternates movie and show by their own rank', () => {
  const movies = [trending('movie', 2), trending('movie', 1), trending('movie', 3)];
  const shows = [trending('tv', 1), trending('tv', 2)];

  const out = interleaveByTrendingRank(movies, shows);

  assert.deepEqual(
    out.map((i) => i.tmdbId),
    ['movie-1', 'tv-1', 'movie-2', 'tv-2', 'movie-3'],
  );
});

test('interleave never re-orders by rating — the Trakt rank is the ordering', () => {
  const movies = [trending('movie', 1, { ratingValue: 4.0 })];
  const shows = [trending('tv', 1, { ratingValue: 9.8 })];

  const out = interleaveByTrendingRank(movies, shows);

  // The 9.8 does not jump the 4.0. That re-sort was the original defect.
  assert.equal(out[0].tmdbId, 'movie-1');
});

test('interleave tolerates an empty or failed side', () => {
  assert.deepEqual(interleaveByTrendingRank([], []), []);
  assert.equal(interleaveByTrendingRank([trending('movie', 1)], []).length, 1);
  assert.equal(interleaveByTrendingRank([], [trending('tv', 1)]).length, 1);
});

test('interleave puts rank-less items last rather than first', () => {
  const movies = [{ mediaType: 'movie', tmdbId: 'no-rank' }, trending('movie', 1)];

  const out = interleaveByTrendingRank(movies, []);

  assert.equal(out[0].tmdbId, 'movie-1');
  assert.equal(out[1].tmdbId, 'no-rank');
});

test('dedupe keeps first occurrence and drops items with no tmdb id', () => {
  const out = dedupeRailItems([
    { mediaType: 'movie', tmdbId: 1, title: 'first' },
    { mediaType: 'movie', tmdbId: 1, title: 'dupe' },
    { mediaType: 'tv', tmdbId: 1, title: 'different media type' },
    { mediaType: 'movie', title: 'no id' },
  ]);

  assert.deepEqual(
    out.map((i) => i.title),
    ['first', 'different media type'],
  );
});

test('now playing sorts by popularity, not by rating', () => {
  const items = [
    playing('low-pop-high-rating', 5, 500, 9.5),
    playing('blockbuster', 900, 4000, 7.1),
  ];

  const out = selectNowPlaying(items, 10, 100);

  assert.equal(out[0].tmdbId, 'blockbuster');
});

test('now playing drops thinly-voted limited releases when there are enough without them', () => {
  const wellVoted = Array.from({ length: RAIL_LIMIT }, (_, i) =>
    playing(`wide-${i}`, 100 - i, NOW_PLAYING_MIN_VOTES + 1),
  );
  const festivalPickup = playing('festival', 10000, 14, 9.9);

  const out = selectNowPlaying([festivalPickup, ...wellVoted]);

  assert.equal(out.length, RAIL_LIMIT);
  assert.ok(!out.some((i) => i.tmdbId === 'festival'));
});

test('now playing keeps the under-voted pool rather than shipping a short rail', () => {
  const thin = Array.from({ length: 4 }, (_, i) => playing(`thin-${i}`, 100 - i, 3));

  const out = selectNowPlaying(thin);

  // An under-voted rail still beats a three-poster one.
  assert.equal(out.length, 4);
});

test('watchers format is short enough for a badge', () => {
  assert.equal(formatWatchers(0), null);
  assert.equal(formatWatchers(null), null);
  assert.equal(formatWatchers(842), '842 watching');
  assert.equal(formatWatchers(1200), '1.2k watching');
  assert.equal(formatWatchers(2000), '2k watching');
  assert.equal(formatWatchers(15400), '15k watching');
});
