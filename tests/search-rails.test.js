import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOW_PLAYING_MIN_VOTES,
  RAIL_LIMIT,
  dedupeRailItems,
  evaluateTheatricalCandidate,
  formatWatchers,
  interleaveByPopularity,
  interleaveByTrendingRank,
  rankTheatricalItems,
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

const popular = (mediaType, id, popularity) => ({ mediaType, tmdbId: id, popularity });

test('interleave by popularity alternates movie/show, highest first on each side', () => {
  const movies = [popular('movie', 'm-lo', 10), popular('movie', 'm-hi', 90)];
  const shows = [popular('tv', 's-hi', 80), popular('tv', 's-lo', 5)];

  const out = interleaveByPopularity(movies, shows);

  assert.deepEqual(
    out.map((i) => i.tmdbId),
    ['m-hi', 's-hi', 'm-lo', 's-lo'],
  );
});

test('interleave by popularity preserves given order when the field is absent', () => {
  // discoverTitles returns items already popularity-sorted but without a
  // `popularity` field — the stable sort must not reshuffle them.
  const movies = [
    { mediaType: 'movie', tmdbId: 'm1' },
    { mediaType: 'movie', tmdbId: 'm2' },
  ];
  const shows = [{ mediaType: 'tv', tmdbId: 's1' }];

  const out = interleaveByPopularity(movies, shows);

  assert.deepEqual(
    out.map((i) => i.tmdbId),
    ['m1', 's1', 'm2'],
  );
});

test('interleave by popularity tolerates an empty or failed side', () => {
  assert.deepEqual(interleaveByPopularity([], []), []);
  assert.equal(interleaveByPopularity([popular('movie', 'm', 1)], []).length, 1);
  assert.equal(interleaveByPopularity([], [popular('tv', 's', 1)]).length, 1);
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

test('evaluateTheatricalCandidate approves legitimate US wide theatrical release', () => {
  const item = { tmdbId: 101, title: 'Studio Epic', popularity: 120, voteCount: 40 };
  const tmdbDetail = {
    release_date: '2026-10-01',
    release_dates: {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [
            { type: 3, release_date: '2026-10-01T00:00:00.000Z', certification: 'PG-13' },
          ],
        },
      ],
    },
    'watch/providers': { results: { US: { flatrate: [], rent: [] } } },
    production_companies: [{ name: 'Paramount Pictures' }],
    budget: 80000000,
  };
  const wikidataDetail = {
    mpaCert: '56047',
    distributors: ['Paramount Pictures'],
  };

  const evalResult = evaluateTheatricalCandidate(item, tmdbDetail, wikidataDetail, {
    today: '2026-10-16',
  });

  assert.equal(evalResult.passed, true);
  assert.equal(evalResult.inExclusiveTheatricalWindow, true);
  assert.equal(evalResult.usWideDate, '2026-10-01');
});

test('evaluateTheatricalCandidate rejects straight-to-streaming original (Netflix)', () => {
  const item = { tmdbId: 102, title: 'Streamer Drop', popularity: 250, voteCount: 300 };
  const tmdbDetail = {
    release_date: '2026-10-09',
    release_dates: {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [
            { type: 2, release_date: '2026-10-09T00:00:00.000Z', note: 'Limited' },
            { type: 4, release_date: '2026-10-09T00:00:00.000Z', note: 'Netflix' },
          ],
        },
      ],
    },
    'watch/providers': { results: { US: { flatrate: [{ provider_name: 'Netflix' }] } } },
  };
  const wikidataDetail = {
    netflixId: '81757047',
    distributors: [],
  };

  const evalResult = evaluateTheatricalCandidate(item, tmdbDetail, wikidataDetail, {
    today: '2026-10-16',
  });

  assert.equal(evalResult.passed, false);
});

test('evaluateTheatricalCandidate rejects short theatrical window (< 28 days)', () => {
  const item = { tmdbId: 103, title: 'Quick Turnaround', popularity: 100, voteCount: 200 };
  const tmdbDetail = {
    release_date: '2026-09-10',
    release_dates: {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [
            { type: 3, release_date: '2026-09-10T00:00:00.000Z', certification: 'R' },
            { type: 4, release_date: '2026-09-29T00:00:00.000Z' }, // 19 days
          ],
        },
      ],
    },
    'watch/providers': { results: { US: { flatrate: [] } } },
  };
  const wikidataDetail = { mpaCert: '55875' };

  const evalResult = evaluateTheatricalCandidate(item, tmdbDetail, wikidataDetail, {
    today: '2026-10-16',
  });

  assert.equal(evalResult.passed, false);
  assert.equal(evalResult.reason, 'short_theatrical_window');
  assert.equal(evalResult.windowDays, 19);
});

test('evaluateTheatricalCandidate rejects old catalog re-releases', () => {
  const item = { tmdbId: 104, title: 'Classic Blockbuster', popularity: 90, voteCount: 20000 };
  const tmdbDetail = {
    release_date: '2019-04-26', // Decades/years old
    release_dates: {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [
            { type: 3, release_date: '2026-09-25T00:00:00.000Z', note: 'Re-release' },
          ],
        },
      ],
    },
    'watch/providers': { results: { US: { flatrate: [{ provider_name: 'Disney Plus' }] } } },
  };

  const evalResult = evaluateTheatricalCandidate(item, tmdbDetail, {}, {
    today: '2026-10-16',
  });

  assert.equal(evalResult.passed, false);
  assert.equal(evalResult.reason, 'primary_out_of_window');
});

test('rankTheatricalItems puts exclusive theatrical titles ahead of PVOD titles', () => {
  const exclusive = { tmdbId: 1, inExclusiveTheatricalWindow: true, popularity: 50 };
  const onPvod = { tmdbId: 2, inExclusiveTheatricalWindow: false, popularity: 200 };
  const exclusiveBig = { tmdbId: 3, inExclusiveTheatricalWindow: true, popularity: 150 };

  const ranked = rankTheatricalItems([exclusive, onPvod, exclusiveBig]);

  assert.deepEqual(
    ranked.map((x) => x.tmdbId),
    [3, 1, 2],
  );
});
