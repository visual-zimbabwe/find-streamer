import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVAILABILITY_TTL_MS,
  compactAvailabilityServices,
  createEmptyAvailabilityCache,
  ensureAvailabilityForItems,
  getFreshAvailability,
  loadAvailabilityCache,
  loadWhereToWatchPrefs,
  matchingServiceKeys,
  persistAvailabilityCache,
  pruneAvailabilityCache,
  saveWhereToWatchPrefs,
  setCachedAvailability,
  titleMatchesWhereToWatch,
  whereToWatchScopeItems,
} from '../src/lib/whereToWatch.js';

function createMemoryStorage(initialEntries = []) {
  const values = new Map(initialEntries);
  return {
    values,
    async getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
}

// ─── Matching ────────────────────────────────────────────────────────────────

test('compactAvailabilityServices keeps only non-empty tracked services', () => {
  const services = compactAvailabilityServices({
    netflix: ['CA', 'US'],
    max: [],
    logos: { netflix: '/n.png' },
    confidence: 'show',
    not_a_service: ['CA'],
  });
  assert.deepEqual(services, { netflix: ['CA', 'US'] });
});

test('titleMatchesWhereToWatch matches a specific service in a country', () => {
  const services = { netflix: ['CA', 'US'], amazon_prime_video: ['GB'] };
  assert.equal(titleMatchesWhereToWatch(services, { countryCode: 'CA', serviceKey: 'netflix' }), true);
  assert.equal(
    titleMatchesWhereToWatch(services, { countryCode: 'GB', serviceKey: 'netflix' }),
    false,
  );
});

test('titleMatchesWhereToWatch with any service matches any provider in the country', () => {
  const services = { amazon_prime_video: ['GB'] };
  assert.equal(titleMatchesWhereToWatch(services, { countryCode: 'GB', serviceKey: null }), true);
  assert.equal(titleMatchesWhereToWatch(services, { countryCode: 'CA', serviceKey: null }), false);
  assert.equal(titleMatchesWhereToWatch(null, { countryCode: 'GB', serviceKey: null }), false);
});

test('matchingServiceKeys lists every service streaming in the country', () => {
  const services = { netflix: ['CA'], cbc_gem: ['CA'], max: ['US'] };
  assert.deepEqual(matchingServiceKeys(services, 'CA'), ['netflix', 'cbc_gem']);
  assert.deepEqual(matchingServiceKeys(services, 'FR'), []);
});

// ─── Scope selection ─────────────────────────────────────────────────────────

test('whereToWatchScopeItems defaults to the whole library and drops removed titles', () => {
  const items = [
    { tmdbId: 1, mediaType: 'movie', status: 'saved', collectionIds: ['a'] },
    { tmdbId: 2, mediaType: 'movie', status: 'dropped', collectionIds: ['a'] },
    { tmdbId: 3, mediaType: 'tv', status: 'watched', collectionIds: ['b'] },
  ];
  assert.deepEqual(
    whereToWatchScopeItems(items).map((item) => item.tmdbId),
    [1, 3],
  );
});

test('whereToWatchScopeItems restricts to selected collections', () => {
  const items = [
    { tmdbId: 1, mediaType: 'movie', status: 'saved', collectionIds: ['a'] },
    { tmdbId: 2, mediaType: 'movie', status: 'saved', collectionIds: ['b'] },
    { tmdbId: 3, mediaType: 'movie', status: 'saved', collectionIds: ['a', 'b'] },
  ];
  assert.deepEqual(
    whereToWatchScopeItems(items, ['b']).map((item) => item.tmdbId),
    [2, 3],
  );
});

// ─── Cache TTL and pruning ───────────────────────────────────────────────────

test('getFreshAvailability honours the TTL', () => {
  const cache = createEmptyAvailabilityCache();
  const t0 = 1_000_000;
  setCachedAvailability(cache, 'movie:1', { netflix: ['CA'] }, t0);

  assert.deepEqual(getFreshAvailability(cache, 'movie:1', t0 + 1000), { netflix: ['CA'] });
  assert.equal(getFreshAvailability(cache, 'movie:1', t0 + AVAILABILITY_TTL_MS + 1), null);
  assert.equal(getFreshAvailability(cache, 'movie:2', t0), null);
});

test('pruneAvailabilityCache drops expired entries and caps at maxEntries newest-first', () => {
  const cache = createEmptyAvailabilityCache();
  const t0 = 1_000_000;
  setCachedAvailability(cache, 'movie:old', { netflix: ['CA'] }, t0 - AVAILABILITY_TTL_MS - 1);
  setCachedAvailability(cache, 'movie:1', {}, t0 - 300);
  setCachedAvailability(cache, 'movie:2', {}, t0 - 200);
  setCachedAvailability(cache, 'movie:3', {}, t0 - 100);

  pruneAvailabilityCache(cache, { maxEntries: 2, now: t0 });
  assert.deepEqual(Object.keys(cache.entries).sort(), ['movie:2', 'movie:3']);
});

test('availability cache round-trips through storage', async () => {
  const storage = createMemoryStorage();
  const cache = createEmptyAvailabilityCache();
  setCachedAvailability(cache, 'tv:42', { max: ['US'] }, 500);

  await persistAvailabilityCache(cache, storage, { now: 1000 });
  const reloaded = await loadAvailabilityCache(storage);
  assert.deepEqual(getFreshAvailability(reloaded, 'tv:42', 1000), { max: ['US'] });
});

test('loadAvailabilityCache tolerates corrupt payloads', async () => {
  const storage = createMemoryStorage([
    ['find-streamer/where-to-watch/availability-cache/v1', '{not json'],
  ]);
  const cache = await loadAvailabilityCache(storage);
  assert.deepEqual(cache, { entries: {} });
});

// ─── Bulk check ──────────────────────────────────────────────────────────────

test('ensureAvailabilityForItems fetches only stale/missing titles and reports progress', async () => {
  const cache = createEmptyAvailabilityCache();
  const t0 = 1_000_000;
  setCachedAvailability(cache, 'movie:1', { netflix: ['CA'] }, t0 - 1000);

  const fetchedIds = [];
  const progress = [];
  const items = [
    { tmdbId: 1, mediaType: 'movie', title: 'Cached' },
    { tmdbId: 2, mediaType: 'movie', title: 'Fresh fetch' },
    { tmdbId: 3, mediaType: 'tv', title: 'Failing fetch' },
  ];

  const result = await ensureAvailabilityForItems(items, {
    cache,
    now: () => t0,
    concurrency: 2,
    onProgress: (p) => progress.push({ ...p }),
    fetchAvailability: async (mediaType, tmdbId) => {
      fetchedIds.push(`${mediaType}:${tmdbId}`);
      if (tmdbId === 3) throw new Error('offline');
      return { netflix: ['US'], max: [] };
    },
  });

  assert.deepEqual(fetchedIds.sort(), ['movie:2', 'tv:3']);
  assert.equal(result.checked, 3);
  assert.equal(result.fetched, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.cancelled, false);
  assert.equal(progress.length, 3);
  assert.deepEqual(progress[progress.length - 1], { checked: 3, total: 3 });
  assert.deepEqual(getFreshAvailability(cache, 'movie:2', t0), { netflix: ['US'] });
  assert.equal(getFreshAvailability(cache, 'tv:3', t0), null);
});

test('ensureAvailabilityForItems stops when shouldContinue turns false', async () => {
  const cache = createEmptyAvailabilityCache();
  let fetches = 0;
  const items = Array.from({ length: 10 }, (_, index) => ({
    tmdbId: index + 1,
    mediaType: 'movie',
    title: `Movie ${index + 1}`,
  }));

  const result = await ensureAvailabilityForItems(items, {
    cache,
    concurrency: 1,
    shouldContinue: () => fetches < 3,
    fetchAvailability: async () => {
      fetches += 1;
      return {};
    },
  });

  assert.equal(result.cancelled, true);
  assert.ok(result.checked < items.length);
});

// ─── Prefs ───────────────────────────────────────────────────────────────────

test('where-to-watch prefs round-trip and fall back to Canada', async () => {
  const storage = createMemoryStorage();

  const defaults = await loadWhereToWatchPrefs(storage);
  assert.deepEqual(defaults, { countryCode: 'CA', countryLabel: 'Canada', serviceKey: null });

  await saveWhereToWatchPrefs(
    { countryCode: 'GB', countryLabel: 'United Kingdom', serviceKey: 'netflix' },
    storage,
  );
  const reloaded = await loadWhereToWatchPrefs(storage);
  assert.deepEqual(reloaded, {
    countryCode: 'GB',
    countryLabel: 'United Kingdom',
    serviceKey: 'netflix',
  });
});

test('prefs with an unknown service key fall back to any service', async () => {
  const storage = createMemoryStorage([
    [
      'find-streamer/where-to-watch/prefs/v1',
      JSON.stringify({ countryCode: 'US', countryLabel: 'United States', serviceKey: 'disney' }),
    ],
  ]);
  const prefs = await loadWhereToWatchPrefs(storage);
  assert.deepEqual(prefs, { countryCode: 'US', countryLabel: 'United States', serviceKey: null });
});
