import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICE_LABELS,
  availabilityBySeason,
  intersectEpisodeAvailability,
  intersectSeasonAvailability,
} from '../src/lib/providerAvailability.js';

/**
 * One episode's `watch/providers` payload: `{ [country]: { [bucket]: [...] } }`
 * wrapped in the `results` envelope TMDB returns.
 */
function episode(map) {
  const results = {};
  for (const [country, buckets] of Object.entries(map)) {
    results[country] = {};
    for (const [bucket, names] of Object.entries(buckets)) {
      results[country][bucket] = names.map((name) => ({
        provider_name: name,
        logo_path: `/${name.replace(/\s+/g, '_').toLowerCase()}.png`,
      }));
    }
  }
  return { results };
}

const NETFLIX_US = episode({ US: { flatrate: ['Netflix'] } });
const NETFLIX_US_GB = episode({ US: { flatrate: ['Netflix'] }, GB: { flatrate: ['Netflix'] } });

// ─── Episode-level intersection ──────────────────────────────────────────────

test('a country survives only when every episode streams there', () => {
  const availability = intersectEpisodeAvailability([NETFLIX_US_GB, NETFLIX_US, NETFLIX_US_GB]);
  // GB is missing from episode 2, so the season as a whole is not watchable there.
  assert.deepEqual(availability.netflix, ['US']);
});

test('all episodes agreeing keeps every country', () => {
  const availability = intersectEpisodeAvailability([NETFLIX_US_GB, NETFLIX_US_GB]);
  assert.deepEqual(availability.netflix, ['GB', 'US']);
});

test('an empty episode list yields no availability, not universal availability', () => {
  const availability = intersectEpisodeAvailability([]);
  Object.keys(SERVICE_LABELS).forEach((key) => {
    assert.deepEqual(availability[key], [], `${key} should be empty`);
  });
});

test('logo paths are collected into the shared map as a side effect', () => {
  const logos = { netflix: null, max: null };
  intersectEpisodeAvailability([NETFLIX_US], logos);
  assert.equal(logos.netflix, '/netflix.png');
});

test('region-locked services stay locked inside the episode fold', () => {
  const gated = episode({ CA: { flatrate: ['CBC Gem'] }, US: { flatrate: ['CBC Gem'] } });
  const availability = intersectEpisodeAvailability([gated, gated]);
  assert.deepEqual(availability.cbc_gem, ['CA']);
});

// ─── Grouping by season ──────────────────────────────────────────────────────

test('episodes are grouped into their own seasons by index', () => {
  const episodes = [
    { seasonNumber: 1, episodeNumber: 1 },
    { seasonNumber: 1, episodeNumber: 2 },
    { seasonNumber: 2, episodeNumber: 1 },
  ];
  const results = [
    NETFLIX_US_GB,
    NETFLIX_US_GB,
    episode({ US: { flatrate: ['Max'] } }), // season 2 moved service
  ];

  const bySeason = availabilityBySeason(episodes, results);

  assert.deepEqual(bySeason[1].netflix, ['GB', 'US']);
  assert.deepEqual(bySeason[2].netflix, []);
  assert.deepEqual(bySeason[2].max, ['US']);
});

test('a season is only as available as its weakest episode', () => {
  const episodes = [
    { seasonNumber: 1, episodeNumber: 1 },
    { seasonNumber: 1, episodeNumber: 2 },
  ];
  const bySeason = availabilityBySeason(episodes, [NETFLIX_US_GB, NETFLIX_US]);
  assert.deepEqual(bySeason[1].netflix, ['US']);
});

test('episodes without a season number are skipped rather than grouped under undefined', () => {
  const bySeason = availabilityBySeason(
    [{ episodeNumber: 1 }, { seasonNumber: 3, episodeNumber: 1 }],
    [NETFLIX_US_GB, NETFLIX_US],
  );
  assert.deepEqual(Object.keys(bySeason), ['3']);
});

// ─── Season → show rollup ────────────────────────────────────────────────────

test('show-level availability is the intersection of the seasons', () => {
  const bySeason = {
    1: { netflix: ['GB', 'US'], max: [] },
    2: { netflix: ['US'], max: [] },
  };
  assert.deepEqual(intersectSeasonAvailability(bySeason).netflix, ['US']);
});

test('one season losing a service removes it show-wide', () => {
  const bySeason = {
    1: { netflix: ['US'] },
    2: { netflix: [] },
  };
  assert.deepEqual(intersectSeasonAvailability(bySeason).netflix, []);
});

test('no seasons yields an empty map with every service key present', () => {
  const availability = intersectSeasonAvailability({});
  Object.keys(SERVICE_LABELS).forEach((key) => {
    assert.deepEqual(availability[key], [], `${key} should be empty`);
  });
});

/**
 * The season split must not change what the show-level table says — folding
 * per-season then across seasons has to equal folding every episode at once.
 */
test('splitting by season leaves the show-level answer unchanged', () => {
  const episodes = [
    { seasonNumber: 1, episodeNumber: 1 },
    { seasonNumber: 1, episodeNumber: 2 },
    { seasonNumber: 2, episodeNumber: 1 },
    { seasonNumber: 2, episodeNumber: 2 },
  ];
  const results = [
    episode({ US: { flatrate: ['Netflix'] }, GB: { flatrate: ['Netflix'] } }),
    episode({ US: { flatrate: ['Netflix'] }, GB: { flatrate: ['Netflix'] } }),
    episode({ US: { flatrate: ['Netflix'] }, GB: { flatrate: ['Netflix'] } }),
    episode({ US: { flatrate: ['Netflix'] } }),
  ];

  const flat = intersectEpisodeAvailability(results);
  const viaSeasons = intersectSeasonAvailability(availabilityBySeason(episodes, results));

  assert.deepEqual(viaSeasons.netflix, flat.netflix);
  assert.deepEqual(viaSeasons.netflix, ['US']);
});
